/**
 * Shared test utilities.
 */

/**
 * Assert that a result is a successful ActionResult.
 */
export function expectSuccess<T>(result: { success: boolean; data?: T; error?: string }): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new Error(`Expected success but got error: ${result.error}`);
  }
}

/**
 * Assert that a result is a failed ActionResult.
 */
export function expectFailure(result: { success: boolean; error?: string }): asserts result is { success: false; error: string } {
  if (result.success) {
    throw new Error("Expected failure but got success");
  }
}
