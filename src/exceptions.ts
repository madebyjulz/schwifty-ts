export class SchwiftyException extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "SchwiftyException";
  }
}

export class InvalidLength extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidLength";
  }
}

export class InvalidStructure extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidStructure";
  }
}

export class InvalidCountryCode extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidCountryCode";
  }
}

export class InvalidBankCode extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidBankCode";
  }
}

export class InvalidBranchCode extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidBranchCode";
  }
}

export class InvalidAccountCode extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidAccountCode";
  }
}

export class InvalidChecksumDigits extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidChecksumDigits";
  }
}

export class InvalidBBANChecksum extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "InvalidBBANChecksum";
  }
}

/**
 * Indicates that national check digits were accepted without being verified.
 *
 * The country's BBAN specification declares a national check-digit field, but no algorithm is
 * registered to verify it. A missing algorithm must not reject an otherwise valid BBAN, so the
 * digits are taken as they are. Callers that require the check to fail instead can turn the
 * warning into an error with `warnings.simplefilter("error", NationalChecksumNotVerified)`.
 *
 * Upstream derives this from Python's `UserWarning`; JavaScript has no warning hierarchy, so it
 * extends `Error` directly. It is deliberately not a `SchwiftyException`.
 */
export class NationalChecksumNotVerified extends Error {
  constructor(message?: string) {
    super(message);
    this.name = "NationalChecksumNotVerified";
  }
}

export class GenerateRandomOverflowError extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "GenerateRandomOverflowError";
  }
}
