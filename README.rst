schwifty-ts
===========

A pure TypeScript port of `schwifty <https://github.com/mdomke/schwifty>`_, the Python library for
working with IBANs and BICs as specified by ISO 13616 and ISO 9362.

This is a **1:1 port** of the Python package. All IBAN/BIC validation logic, checksum algorithms,
and bank registry data are identical to the upstream Python version. Zero runtime dependencies.

Features
--------

``schwifty-ts`` lets you

* validate check-digits and the country specific format of IBANs
* validate format and country codes from BICs
* generate BICs from country and bank-code
* generate IBANs from country-code, bank-code and account-number
* generate random valid IBANs
* get the BIC associated to an IBAN's bank-code
* access all relevant components as properties

Installation
------------

.. code-block:: bash

  $ npm install schwifty-ts

Usage
-----

.. code-block:: typescript

  import { IBAN, BIC } from "schwifty-ts";

  // Validate an IBAN
  const iban = new IBAN("DE89370400440532013000");
  iban.isValid;       // true
  iban.countryCode;   // "DE"
  iban.bankCode;      // "37040044"
  iban.bankName;      // "Commerzbank"
  iban.bic?.compact;  // "COBADEFFXXX"
  iban.formatted;     // "DE89 3704 0044 0532 0130 00"

  // Generate an IBAN
  const generated = IBAN.generate("DE", "37040044", "0532013000");
  generated.compact;  // "DE89370400440532013000"

  // Random IBAN
  const random = IBAN.random("ES");
  random.isValid;     // true

  // Validate a BIC
  const bic = new BIC("COBADEFFXXX");
  bic.countryCode;    // "DE"

  // Look up BIC from bank code
  BIC.fromBankCode("DE", "37040044").compact;  // "COBADEFFXXX"

Versioning
----------

Versions follow the upstream Python package using `CalVer <https://www.calver.org/>`_ with the scheme
``YY.0M.Micro``. The major/minor version always matches the corresponding ``schwifty`` Python
release. Patch-level increments (e.g. ``2026.03.0-1``) are reserved for TypeScript-specific fixes
only.

Issues
------

This package is a direct port of the Python library. Please file issues in the correct place:

* **TypeScript-specific bugs** (build, types, bundling, JS runtime issues):
  `schwifty-ts issues <https://github.com/madebyjulz/schwifty-ts/issues>`_
* **IBAN/BIC validation logic, bank registry data, checksum algorithms**:
  `schwifty (Python) issues <https://github.com/mdomke/schwifty/issues>`_

Project Information
-------------------

``schwifty-ts`` is released under `MIT`_ license. The code is maintained on `GitHub`_ and packages
are distributed on `npm`_.

.. _MIT: https://choosealicense.com/licenses/mit/
.. _GitHub: https://github.com/madebyjulz/schwifty-ts
.. _npm: https://www.npmjs.com/package/schwifty-ts
