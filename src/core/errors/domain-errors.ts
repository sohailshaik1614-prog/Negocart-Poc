export class DomainError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number = 400, code: string = "DOMAIN_ERROR") {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FloorPriceBreachError extends DomainError {
  constructor(message: string = "Proposed price violates merchant minimum floor price") {
    super(message, 422, "FLOOR_PRICE_BREACHED");
  }
}

export class NegotiationRoundsExceededError extends DomainError {
  constructor(message: string = "Negotiation maximum rounds limit reached") {
    super(message, 400, "ROUNDS_EXCEEDED");
  }
}

export class SessionExpiredError extends DomainError {
  constructor(message: string = "Negotiation session has expired") {
    super(message, 410, "SESSION_EXPIRED");
  }
}

export class SessionAlreadyClosedError extends DomainError {
  constructor(message: string = "Negotiation session has already been concluded") {
    super(message, 409, "SESSION_ALREADY_CLOSED");
  }
}

export class InvalidSessionTokenError extends DomainError {
  constructor(message: string = "Invalid or tampered negotiation session token") {
    super(message, 401, "INVALID_SESSION_TOKEN");
  }
}

export class TenantAccessDeniedError extends DomainError {
  constructor(message: string = "Access denied for requested merchant resource") {
    super(message, 403, "TENANT_ACCESS_DENIED");
  }
}

export class StoreNotFoundError extends DomainError {
  constructor(message: string = "Store not found or public store key invalid") {
    super(message, 404, "STORE_NOT_FOUND");
  }
}

export class ProductNotEligibleError extends DomainError {
  constructor(message: string = "Product is not eligible for negotiation") {
    super(message, 403, "PRODUCT_NOT_ELIGIBLE");
  }
}

export class PlanQuotaExceededError extends DomainError {
  constructor(message: string = "Monthly negotiation limit reached for your subscription plan") {
    super(message, 402, "PLAN_QUOTA_EXCEEDED");
  }
}

