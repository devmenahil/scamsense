/** Thrown by output parsers when Gemini's JSON is unusable. Shared by the Gemini client and the pure validators. */
export class InvalidOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidOutputError";
  }
}
