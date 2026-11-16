type QueryExecutor = { query: (sql:string, params?:unknown[]) => Promise<{rows:Record<string,unknown>[]}> };
export type ProjectPermissionAction = 'view'|'create'|'update'|'approve'|'delete';
export type ProjectPermissionResult = {
  allowed:boolean;
  organizationId:string;
  membershipId:string|null;
  departmentId:string|null;
  scope:string|null;
  isAdministrator:boolean;
};

/**
 * Resolves organization role, project membership and the configured custom-role
 * permission in one organization-scoped lookup. Assigned/own scopes are returned
 * to the caller so it can additionally constrain the target record to the actor.
 */
export async function checkProjectPermission(
  executor:QueryExecutor,
  projectId:string,
  userId:string,
  permissionCode:string,
  action:ProjectPermissionAction,
):Promise<ProjectPermissionResult|null>{
  const r=await executor.query(
    `SELECT p.organization_id,
            actor.id AS membership_id,
            actor.department_id,
            om.role AS organization_role,
            pmx.access_level,
            CASE
              WHEN om.role IN ('owner','admin') OR pmx.access_level='project_admin' THEN true
              ELSE COALESCE((
                SELECT CASE $4::text
                  WHEN 'view' THEN rp.can_view
                  WHEN 'create' THEN rp.can_create
                  WHEN 'update' THEN rp.can_update
                  WHEN 'approve' THEN rp.can_approve
                  WHEN 'delete' THEN rp.can_delete
                  ELSE false END
                FROM pm_role_permissions rp
                JOIN pm_permissions perm ON perm.id=rp.permission_id
                WHERE rp.organization_id=p.organization_id
                  AND rp.role_id=actor.role_id
                  AND perm.code=$3
                LIMIT 1
              ),false)
            END AS allowed,
            CASE
              WHEN om.role IN ('owner','admin') OR pmx.access_level='project_admin' THEN 'organization'
              ELSE (
                SELECT rp.access_scope
                FROM pm_role_permissions rp
                JOIN pm_permissions perm ON perm.id=rp.permission_id
                WHERE rp.organization_id=p.organization_id
                  AND rp.role_id=actor.role_id
                  AND perm.code=$3
                LIMIT 1
              )
            END AS permission_scope,
            (om.role IN ('owner','admin') OR pmx.access_level='project_admin') AS is_administrator,
            manager.department_id AS project_department_id
     FROM pm_projects p
     JOIN organization_accounts oa ON oa.id=p.organization_id AND oa.status='active'
     JOIN organization_memberships om ON om.organization_id=p.organization_id
       AND om.user_id=$2 AND om.status='active'
     LEFT JOIN pm_memberships actor ON actor.organization_id=p.organization_id
       AND actor.user_id=$2 AND actor.status='active'
     LEFT JOIN pm_project_members pmx ON pmx.project_id=p.id
       AND pmx.organization_id=p.organization_id AND pmx.membership_id=actor.id AND pmx.status='active'
     LEFT JOIN pm_memberships manager ON manager.id=p.project_manager_membership_id
       AND manager.organization_id=p.organization_id
     WHERE p.id=$1 AND p.status<>'archived'
       AND (om.role IN ('owner','admin') OR pmx.id IS NOT NULL)
     LIMIT 1`,
    [projectId,userId,permissionCode,action],
  );
  const row=r.rows[0];
  if(!row)return null;
  const admin=row.is_administrator===true;
  const scope=String(row.permission_scope||'');
  const membershipId=row.membership_id==null?null:String(row.membership_id);
  const departmentId=row.department_id==null?null:String(row.department_id);
  const projectDepartmentId=row.project_department_id==null?null:String(row.project_department_id);
  const scopeAllowed=admin || scope==='organization' ||
    (scope==='project' && row.access_level!=null) ||
    (scope==='department' && row.access_level!=null && !!departmentId && departmentId===projectDepartmentId) ||
    ((scope==='assigned'||scope==='own') && row.access_level!=null);
  return {
    allowed:row.allowed===true && scopeAllowed,
    organizationId:String(row.organization_id),
    membershipId,
    departmentId,
    scope:admin?'organization':scope||null,
    isAdministrator:admin,
  };
}
