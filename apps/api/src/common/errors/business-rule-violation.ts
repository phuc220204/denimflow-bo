// Thrown by services when a business rule (BR-xx) forbids an action.
// BusinessRuleViolationFilter turns it into an HTTP response with a stable code.
export class BusinessRuleViolation extends Error {
  constructor(
    readonly brId: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'BusinessRuleViolation';
  }
}
