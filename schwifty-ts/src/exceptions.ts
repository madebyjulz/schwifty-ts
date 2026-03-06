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

export class GenerateRandomOverflowError extends SchwiftyException {
  constructor(message?: string) {
    super(message);
    this.name = "GenerateRandomOverflowError";
  }
}
