import { SessionStatus } from "@/core/types/negotiation.types";
import { DomainError } from "@/core/errors/domain-errors";

export class NegotiationStateMachine {
  private static readonly VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
    CREATED: ["ACTIVE", "COUNTERED", "FINAL_OFFER", "ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"],
    INITIALIZED: ["ACTIVE", "COUNTERED", "FINAL_OFFER", "ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"],
    ACTIVE: ["COUNTERED", "FINAL_OFFER", "ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"],
    COUNTERED: ["ACTIVE", "COUNTERED", "FINAL_OFFER", "ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"],
    FINAL_OFFER: ["ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"], // Take-it-or-leave-it: no further counter allowed
    ACCEPTED: [], // Terminal state
    REJECTED: [], // Terminal state
    EXPIRED: [], // Terminal state
    TERMINATED: [], // Terminal state
  };

  /**
   * Validates if state transition is legally permissible
   */
  public static canTransition(current: SessionStatus, next: SessionStatus): boolean {
    return this.VALID_TRANSITIONS[current]?.includes(next) ?? false;
  }

  /**
   * Asserts transition validity, throwing a DomainError if invalid
   */
  public static assertTransition(current: SessionStatus, next: SessionStatus): void {
    if (current === next) return;

    if (!this.canTransition(current, next)) {
      throw new DomainError(
        `Illegal state transition from ${current} to ${next}`,
        400,
        "ILLEGAL_STATE_TRANSITION"
      );
    }
  }

  public static isTerminal(status: SessionStatus): boolean {
    return ["ACCEPTED", "REJECTED", "EXPIRED", "TERMINATED"].includes(status);
  }
}
