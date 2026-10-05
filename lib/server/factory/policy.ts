export type CostClass = 'FREE' | 'FREE_WITH_LIMIT' | 'PAID' | 'UNKNOWN' | 'BLOCKED';

export type OperationAssessment =
  | { status: 'allowed'; reason: string }
  | { status: 'blocked'; reason: string }
  | { status: 'approval_required'; reason: string };

export function assessOperation(input: {
  costClass: CostClass;
  spendLimitMinor: number;
  paidActionsAllowed: boolean;
  ownerApprovalRequired: boolean;
  freeResourceAllowed: boolean;
  unknownCostAction: 'block' | string;
  withinFreeLimit?: boolean;
  externalAction?: boolean;
  authorizedIntegration?: boolean;
  ownerApproved?: boolean;
}): OperationAssessment {
  if (input.costClass === 'BLOCKED') return { status: 'blocked', reason: 'Provider or action is disabled by policy.' };
  if (input.costClass === 'PAID' || input.paidActionsAllowed || input.spendLimitMinor !== 0) {
    return { status: 'blocked', reason: 'Autonomous spend is ₹0; paid actions are blocked.' };
  }
  if (input.costClass === 'UNKNOWN' || input.unknownCostAction !== 'block') {
    return { status: 'blocked', reason: 'Unknown-cost resources fail closed.' };
  }
  if (input.externalAction) {
    if (!input.authorizedIntegration) return { status: 'blocked', reason: 'No authorized external integration is configured.' };
    if (input.ownerApprovalRequired && !input.ownerApproved) return { status: 'approval_required', reason: 'Owner approval is required before external communication.' };
  }
  if (!input.freeResourceAllowed) return { status: 'blocked', reason: 'Free resources are disabled by policy.' };
  if (input.costClass === 'FREE_WITH_LIMIT' && !input.withinFreeLimit) {
    return { status: 'blocked', reason: 'The free-tier usage limit is exhausted or unavailable.' };
  }
  if (input.costClass !== 'FREE' && input.costClass !== 'FREE_WITH_LIMIT') {
    return { status: 'blocked', reason: 'Provider cost class is not eligible for automatic execution.' };
  }
  return { status: 'allowed', reason: 'Zero-cost policy permits this free internal operation.' };
}
