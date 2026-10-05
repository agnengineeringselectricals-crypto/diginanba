export function isFactoryAuthorized(roles:string[],mode:'view'|'manage'='view'){
  const allowed=mode==='manage'?['Super Admin','Operations Admin','AI Factory Manager']:['Super Admin','Operations Admin','AI Factory Manager','Read-Only Analyst'];
  return roles.some((role)=>allowed.includes(role));
}
