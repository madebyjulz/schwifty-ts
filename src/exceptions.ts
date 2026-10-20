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
 * Indicates that national check digits could not be verified.
 *
 * The country's BBAN specification declares a national check-digit field, but no algorithm is
 * registered to verify it. Reported with `unverifiedChecksum: "warn"` and thrown with
 * `unverifiedChecksum: "error"`.
 *
 * Deviation: upstream derives this from Python's `UserWarning` and raises it only through the
 * `warnings` filters. Here it is thrown as a validation failure on request, so it extends
 * `SchwiftyException` like every other one.
 */
export class NationalChecksumNotVerified extends SchwiftyException {
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
