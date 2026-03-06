import { describe, it, expect } from "vitest";
import { BIC } from "../src/bic.ts";
import { BBAN } from "../src/bban.ts";
import { IBAN, convertBbanSpecToRegex } from "../src/iban.ts";
import { SchwiftyException } from "../src/exceptions.ts";
import { getCountry } from "../src/countries.ts";

const valid = [
  "AL47 2121 1009 0000 0002 3569 8741",
  "AD12 0001 2030 2003 5910 0100",
  "AT61 1904 3002 3457 3201",
  "AZ21 NABZ 0000 0000 1370 1000 1944",
  "BH67 BMAG 0000 1299 1234 56",
  "BE68 5390 0754 7034",
  "BA39 1290 0794 0102 8494",
  "BR97 0036 0305 0000 1000 9795 493P 1",
  "BR18 0000 0000 1414 5512 3924 100C 2",
  "BG80 BNBG 9661 1020 3456 78",
  "CR05 0152 0200 1026 2840 66",
  "HR12 1001 0051 8630 0016 0",
  "CY17 0020 0128 0000 0012 0052 7600",
  "CZ65 0800 0000 1920 0014 5399",
  "CZ94 5500 0000 0010 1103 8930",
  "DK50 0040 0440 1162 43",
  "FO62 6460 0001 6316 34",
  "GL89 6471 0001 0002 06",
  "DO28 BAGR 0000 0001 2124 5361 1324",
  "EE38 2200 2210 2014 5685",
  "FI21 1234 5600 0007 85",
  "FR14 2004 1010 0505 0001 3M02 606",
  "GE29 NB00 0000 0101 9049 17",
  "DE89 3704 0044 0532 0130 00",
  "GI75 NWBK 0000 0000 7099 453",
  "GR16 0110 1250 0000 0001 2300 695",
  "GT82 TRAJ 0102 0000 0012 1002 9690",
  "HU42 1177 3016 1111 1018 0000 0000",
  "IS14 0159 2600 7654 5510 7303 39",
  "IE29 AIBK 9311 5212 3456 78",
  "IL62 0108 0000 0009 9999 999",
  "IT60 X054 2811 1010 0000 0123 456",
  "JO94 CBJO 0010 0000 0000 0131 0003 02",
  "KZ86 125K ZT50 0410 0100",
  "XK05 1212 0123 4567 8906",
  "KW81 CBKU 0000 0000 0000 1234 5601 01",
  "LV80 BANK 0000 4351 9500 1",
  "LB62 0999 0000 0001 0019 0122 9114",
  "LI21 0881 0000 2324 013A A",
  "LT12 1000 0111 0100 1000",
  "LU28 0019 4006 4475 0000",
  "MK07 2501 2000 0058 984",
  "MT84 MALT 0110 0001 2345 MTLC AST0 01S",
  "MR13 0002 0001 0100 0012 3456 753",
  "MU17 BOMM 0101 1010 3030 0200 000M UR",
  "MD24 AG00 0225 1000 1310 4168",
  "MC58 1122 2000 0101 2345 6789 030",
  "ME25 5050 0001 2345 6789 51",
  "NL91 ABNA 0417 1643 00",
  "NO93 8601 1117 947",
  "PK36 SCBL 0000 0011 2345 6702",
  "PS92 PALS 0000 0000 0400 1234 5670 2",
  "PL61 1090 1014 0000 0712 1981 2874",
  "PT50 0002 0123 1234 5678 9015 4",
  "QA58 DOHB 0000 1234 5678 90AB CDEF G",
  "RO49 AAAA 1B31 0075 9384 0000",
  "LC55 HEMM 0001 0001 0012 0012 0002 3015",
  "SM86 U032 2509 8000 0000 0270 100",
  "ST68 0001 0001 0051 8453 1011 2",
  "SA03 8000 0000 6080 1016 7519",
  "RS35 2600 0560 1001 6113 79",
  "SN08 SN01 0015 2000 0485 0000 3035",
  "SC18 SSCB 1101 0000 0000 0000 1497 USD",
  "SK31 1200 0000 1987 4263 7541",
  "SI56 1910 0000 0123 438",
  "ES91 2100 0418 4502 0005 1332",
  "SE45 5000 0000 0583 9825 7466",
  "CH93 0076 2011 6238 5295 7",
  "TL38 0080 0123 4567 8910 157",
  "TN59 1000 6035 1835 9847 8831",
  "TR33 0006 1005 1978 6457 8413 26",
  "UA21 3996 2200 0002 6007 2335 6600 1",
  "AE07 0331 2345 6789 0123 456",
  "GB29 NWBK 6016 1331 9268 19",
  "VG96 VPVG 0000 0123 4567 8901",
  "BY13 NBRB 3600 9000 0000 2Z00 AB00",
  "SV62 CENR 0000 0000 0000 0070 0025",
  "FO62 6460 0001 6316 34",
  "GL89 6471 0001 0002 06",
  "IQ98 NBIQ 8501 2345 6789 012",
];

const invalid = [
  "DE89 3704 0044 0532 0130",
  "DE89 3704 0044 0532 0130 0000",
  "GB96 BARC 2020 1530 0934 591",
  "XX89 3704 0044 0532 0130 00",
  "DE99 3704 0044 0532 0130 00",
  "DEAA 3704 0044 0532 0130 00",
  "GB2L ABBY 0901 2857 2017 07",
  "DE89 AA04 0044 0532 0130 00",
  "GB12 BARC 2020 1530 093A 59",
  "GB01 BARC 2071 4583 6083 87",
  "GB00 HLFX 1101 6111 4553 65",
  "GB94 BARC 2020 1530 0934 59",
];

const sepaCountries = new Set([
  "AD", "AT", "BE", "BG", "CH", "CY", "CZ", "DE", "DK", "EE", "ES",
  "FI", "FR", "GB", "GI", "GR", "HR", "HU", "IE", "IS", "IT", "LI",
  "LT", "LU", "LV", "MC", "MT", "NL", "NO", "PL", "PT", "RO", "SE",
  "SK", "SI", "SM", "VA",
]);

describe("IBAN parsing", () => {
  it.each(valid)("parses valid IBAN %s", (value) => {
    const iban = new IBAN(value, { validateBban: true });
    expect(iban.formatted).toBe(value);
    expect(iban.country).toBe(getCountry(iban.countryCode));
    expect(iban.inSepaZone).toBe(sepaCountries.has(iban.countryCode));
  });

  it.each(invalid)("allows invalid IBAN %s with flag", (value) => {
    const iban = new IBAN(value, { allowInvalid: true });
    expect(() => iban.validate()).toThrow(SchwiftyException);
  });

  it.each(invalid)("rejects invalid IBAN %s", (value) => {
    expect(() => new IBAN(value)).toThrow(SchwiftyException);
  });
});

describe("IBAN properties", () => {
  it("DE properties", () => {
    const iban = new IBAN("DE42430609677000534100");
    expect(iban.isValid).toBe(true);
    expect(iban.bankCode).toBe("43060967");
    expect(iban.branchCode).toBe("");
    expect(iban.accountCode).toBe("7000534100");
    expect(iban.accountId).toBe("");
    expect(iban.accountType).toBe("");
    expect(iban.countryCode).toBe("DE");
    expect(iban.currencyCode).toBe("");
    expect(iban.accountHolderId).toBe("");
    expect(iban.nationalChecksumDigits).toBe("");
    expect(iban.bic?.compact).toBe("GENODEM1GLS");
    expect(iban.formatted).toBe("DE42 4306 0967 7000 5341 00");
    expect(iban.length).toBe(22);
    expect(iban.country).toBeDefined();
    expect(iban.bankName).toBe("GLS Gemeinschaftsbank");
    expect(iban.bankShortName).toBe("GLS Gemeinschaftsbk Bochum");
    expect(iban.inSepaZone).toBe(true);
  });

  it("IT properties", () => {
    const iban = new IBAN("IT60 X054 2811 1010 0000 0123 456");
    expect(iban.bankCode).toBe("05428");
    expect(iban.branchCode).toBe("11101");
    expect(iban.accountCode).toBe("000000123456");
    expect(iban.nationalChecksumDigits).toBe("X");
    expect(iban.country).toBeDefined();
    expect(iban.bic?.compact).toBe("BLOPIT22");
    expect(iban.bankName).toBe("Unione Di Banche Italiane SpA");
    expect(iban.inSepaZone).toBe(true);
  });

  it("IS properties", () => {
    const iban = new IBAN("IS14 0159 2600 7654 5510 7303 39");
    expect(iban.accountHolderId).toBe("5510730339");
    expect(iban.accountCode).toBe("007654");
    expect(iban.accountType).toBe("26");
    expect(iban.branchCode).toBe("59");
    expect(iban.bankCode).toBe("01");
  });

  it("PL properties", () => {
    const iban = new IBAN("PL66114010100000123400005678");
    expect(iban.isValid).toBe(true);
    expect(iban.bankCode).toBe("11401010");
    expect(iban.branchCode).toBe("");
    expect(iban.accountCode).toBe("0000123400005678");
    expect(iban.countryCode).toBe("PL");
    expect(iban.nationalChecksumDigits).toBe("0");
    expect(iban.bic?.compact).toBe("BREXPLPWWA1");
    expect(iban.formatted).toBe("PL66 1140 1010 0000 1234 0000 5678");
    expect(iban.length).toBe(28);
    expect(iban.bankName).toBe("mBank Sp\u00f3\u0142ka Akcyjna");
    expect(iban.bankShortName).toBe("mBank Sp\u00f3\u0142ka Akcyjna");
    expect(iban.inSepaZone).toBe(true);
  });
});

describe("IBAN generation", () => {
  const generateCases: [string[], string][] = [
    [["BE", "050", "123"], "BE66050000012343"],
    [["BE", "050", "123456"], "BE45050012345689"],
    [["BE", "539", "0075470"], "BE68539007547034"],
    [["BE", "050", "177"], "BE54050000017797"],
    [["DE", "43060967", "7000534100"], "DE42430609677000534100"],
    [["DE", "51230800", "2622196545"], "DE61512308002622196545"],
    [["DE", "20690500", "9027378"], "DE37206905000009027378"],
    [["DK", "0040", "0440116243"], "DK5000400440116243"],
    [["FR", "2004101005", "0500013M026"], "FR1420041010050500013M02606"],
    [["GB", "NWBK", "31926819", "601613"], "GB29NWBK60161331926819"],
    [["GB", "NWBK", "31926819"], "GB66NWBK00000031926819"],
    [["GB", "NWBK601613", "31926819"], "GB29NWBK60161331926819"],
    [["IT", "0538703601", "000000198036"], "IT18T0538703601000000198036"],
    [["IT", "0538703601", "000000198060"], "IT57V0538703601000000198060"],
    [["IT", "0538703601", "000000198072"], "IT40Z0538703601000000198072"],
    [["IT", "0538742530", "000000802006"], "IT29P0538742530000000802006"],
    [["IT", "0306940101", "100100003599"], "IT94I0306940101100100003599"],
    [["IT", "0335901600", "100000131525"], "IT63M0335901600100000131525"],
    [["IT", "03359", "100000131525", "01600"], "IT63M0335901600100000131525"],
    [["IT", "39189", "CHTEE9UATVVO", "13896"], "IT12D3918913896CHTEE9UATVVO"],
    [["IT", "49076", "YB4EQZ0PL4GT", "75919"], "IT70Y4907675919YB4EQZ0PL4GT"],
    [["IT", "05428", "00ABCD12ZE34", "01600"], "IT21Q054280160000ABCD12ZE34"],
    [["IT", "05428", "000000123456", "11101"], "IT60X0542811101000000123456"],
    [["IT", "55354", "AUKNAEXQVZOG", "87408"], "IT77D5535487408AUKNAEXQVZOG"],
    [["IT", "31582", "YMZJIILHBUN0", "80362"], "IT49B3158280362YMZJIILHBUN0"],
    [["IT", "39814", "LSLLPTLPK716", "69135"], "IT37W3981469135LSLLPTLPK716"],
    [["IT", "86388", "3VVRNLLMMN9N", "85779"], "IT69U86388857793VVRNLLMMN9N"],
    [["IT", "43482", "DNNDKPHAGTIB", "07900"], "IT22K4348207900DNNDKPHAGTIB"],
    [["IT", "70000", "Mq8gyacBzEqP", "30810"], "IT39M7000030810MQ8GYACBZEQP"],
    [["IT", "76494", "2Sbpqelox4wG", "16460"], "IT87A76494164602SBPQELOX4WG"],
    [["PL", "11401010", "0000123400005678"], "PL66114010100000123400005678"],
    [["PL", "11401010", "123400005678"], "PL66114010100000123400005678"],
    [["PL", "11401010", "12340000"], "PL04114010100000000012340000"],
    [["PL", "11401010", "1234"], "PL89114010100000000000001234"],
  ];

  it.each(generateCases)("generates from %j = %s", (components, compact) => {
    const [cc, bank, account, branch, ...rest] = components;
    const extra: Record<string, string> = {};
    // No extra fields used in these tests
    const iban = IBAN.generate(cc, bank, account, branch || "", extra);
    iban.validate(true);
    expect(iban.compact).toBe(compact);
  });

  const invalidGenerateCases: string[][] = [
    ["DE", "012345678", "7000123456"],
    ["DE", "51230800", "01234567891"],
    ["GB", "NWBK", "31926819", "1234567"],
    ["PL", "11401010", "ABCD"],
    ["PL", "11401010", "10000123400005678"],
  ];

  it.each(invalidGenerateCases)(
    "rejects invalid generation %j",
    (components) => {
      const [cc, bank, account, branch] = components;
      expect(() => IBAN.generate(cc, bank, account, branch || "")).toThrow(
        SchwiftyException,
      );
    },
  );
});

describe("BIC from IBAN", () => {
  const bicFromIbanCases: [string, string][] = [
    ["AD1200012030200359100100", "BACAADADXXX"],
    ["AE070331234567890123456", "BOMLAEADXXX"],
    ["AT483200000012345864", "RLNWATWWXXX"],
    ["AT930100000000123145", "BUNDATWWXXX"],
    ["BA393385804800211234", "UNCRBA22XXX"],
    ["BE71096123456769", "GKCCBEBB"],
    ["BG18RZBB91550123456789", "RZBBBGSF"],
    ["CH5604835012345678009", "CRESCHZZ80A"],
    ["CR23015108410026012345", "BNCRCRSJXXX"],
    ["CY21002001950000357001234567", "BCYPCY2N"],
    ["CZ5508000000001234567899", "GIBACZPX"],
    ["DE37206905000009027378", "GENODEF1S11"],
    ["EE471000001020145685", "EEUHEE2X"],
    ["ES7921000813610123456789", "CAIXESBB"],
    ["FI1410093000123458", "NDEAFIHH"],
    ["FR7630006000011234567890189", "AGRIFRPPXXX"],
    ["GB33BUKB20201555555555", "BUKBGB22"],
    ["GR9608100010000001234567890", "BOFAGR2XXXX"],
    ["HR1723600001101234565", "ZABAHR2X"],
    ["HU42117730161111101800000000", "OTPVHUHB"],
    ["IE64IRCE92050112345678", "IRCEIE2DXXX"],
    ["IT60X0542811101000000123456", "BLOPIT22"],
    ["IS480114007083000000000000", "NBIIISRE"],
    ["KZ244350000012344567", "SHBKKZKA"],
    ["LT601010012345678901", "LIABLT2XXXX"],
    ["LU120010001234567891", "BCEELULL"],
    ["LV97HABA0012345678910", "HABALV22XXX"],
    ["MD21EX000000000001234567", "EXMMMD22"],
    ["MD24AG000225100013104168", "AGRNMD2X"],
    ["NL02ABNA0123456789", "ABNANL2A"],
    ["NO8330001234567", "SPSONO22"],
    ["PL50860000020000000000093122", "POLUPLPRXXX"],
    ["PL66114010100000123400005678", "BREXPLPWWA1"],
    ["PT50002700000001234567833", "BPIPPTPLXXX"],
    ["RO66BACX0000001234567890", "BACXROBU"],
    ["RS35105008123123123173", "AIKBRS22XXX"],
    ["SE7280000810340009783242", "SWEDSESS"],
    ["SI56192001234567892", "SZKBSI2XXXX"],
    ["SK8975000000000012345671", "CEKOSKBX"],
    ["LI21088100002324013AA", "BLFLLI2XXXX"],
  ];

  it.each(bicFromIbanCases)(
    "BIC from IBAN %s = %s",
    (ibanStr, expectedBic) => {
      const bic = new IBAN(ibanStr).bic;
      expect(bic).not.toBeNull();
      expect(bic!.compact).toBe(expectedBic);
    },
  );

  it("unknown BIC from IBAN", () => {
    expect(new IBAN("SI72000001234567892").bic).toBeNull();
  });

  it("unknown bank name from IBAN", () => {
    expect(new IBAN("SI72000001234567892").bankName).toBeNull();
  });

  it("unknown bank short name from IBAN", () => {
    expect(new IBAN("SI72000001234567892").bankShortName).toBeNull();
  });
});

describe("IBAN random", () => {
  it("generates random IBANs", () => {
    for (let i = 0; i < 100; i++) {
      const iban = IBAN.random();
      expect(iban).toBeInstanceOf(IBAN);
    }
  });

  it("handles special cases", () => {
    const muIban = IBAN.random("MU");
    expect(muIban.endsWith("000MUR")).toBe(true);

    const scIban = IBAN.random("SC");
    expect(scIban.endsWith("SCR")).toBe(true);

    const kmIban = IBAN.random("KM");
    expect(kmIban.isValid).toBe(true);
  });
});

describe("BBAN spec to regex", () => {
  const cases: [string, string][] = [
    ["5!n", "^\\d{5}$"],
    ["4!a", "^[A-Z]{4}$"],
    ["10!c", "^[A-Za-z0-9]{10}$"],
    ["5!e", "^ {5}$"],
    ["3n", "^\\d{1,3}$"],
    ["5!n3!a", "^\\d{5}[A-Z]{3}$"],
  ];

  it.each(cases)("converts %s to %s", (spec, expected) => {
    expect(convertBbanSpecToRegex(spec)).toBe(expected);
  });
});

describe("IBAN magic methods", () => {
  it("equality and comparison", () => {
    const iban = new IBAN("DE42430609677000534100");
    expect(iban.equals("DE42430609677000534100")).toBe(true);
    expect(iban.equals(new IBAN("DE42430609677000534100"))).toBe(true);
    expect(iban.equals(new IBAN("ES9121000418450200051332"))).toBe(false);
    expect(iban.lessThan(new IBAN("ES9121000418450200051332"))).toBe(true);
    expect(String(iban)).toBe("DE42430609677000534100");
    expect(iban.repr()).toBe("<IBAN=DE42430609677000534100>");
  });
});
