.. _changelog:

Changelog
=========

Versions follow the upstream `schwifty <https://github.com/mdomke/schwifty>`_ Python package using
`CalVer <http://www.calver.org/>`_ with the scheme ``YY.0M.Micro``. Patch-level increments
(e.g. ``2026.03.0-1``) are reserved for TypeScript-specific fixes only.

For the full upstream changelog see the
`schwifty changelog <https://github.com/mdomke/schwifty/blob/main/CHANGELOG.rst>`_.

``2026.07.3`` - 2026/07/23
--------------------------

Ports upstream ``2026.07.0`` through ``2026.07.3``.

Added
~~~~~
* Yemen (``YE``) to the IBAN registry.
* ``BBAN.random`` now *constructs* a valid national checksum instead of generating
  candidates until one happens to validate. Each checksum algorithm can ``solve`` the
  components it owns: the German methods splice a valid check digit into the account
  code, Iceland fixes its embedded check digit, and the Czech and Slovak methods adjust
  the account and branch codes to satisfy their mod-11 constraints. Random IBANs are now
  produced on the first attempt for effectively every country and bank.
* Typed registry queries — ``getIbanSpec``, ``getBanksByCountry``, ``getBanksByCode``,
  ``getBanksByBic``, ``getCountries`` and ``getAllBanks`` — replacing the untyped
  ``registry.get``/``has``/``save``/``buildIndex``/``manipulate`` helpers. Indexes are now
  built lazily on first use rather than as an import side effect.

Changed
~~~~~~~
* ``IBAN.spec`` returns an ``IBANSpec`` and ``IBAN.bank``/``BBAN.bank`` return a ``Bank``.
  ``spec.positions`` is now a ``Record<Component, Range>`` that is always fully populated,
  ``spec.bic_lookup_components`` is always an array, and ``spec.default_currency_code``
  moved into ``spec.defaults``. Upstream's Python-only dict-access compatibility shim is
  not ported — attribute access already was the only option here.
* ``convertBbanSpecToRegex`` moved from ``iban.ts`` to ``registry.ts``.

Fixed
~~~~~
* IBAN character validation is anchored over the whole string. It previously matched only
  the country/check-digit prefix and excluded digits from the BBAN, so invalid characters
  further along slipped through.
* Registered the ISO 7064 mod 97-10 national checksum for Bosnia and Herzegovina (``BA``)
  instead of ``BT`` (Bhutan, which has no IBAN).
* ``BBAN.validateNationalChecksum`` returns ``true`` on success — it previously returned
  ``false`` when an algorithm had run and validated.
* German checksum method ``08``: the check digit applies from account number ``60000``
  upward, not ``6000``.
* German checksum method ``16``: computed like method ``06`` over account positions
  ``1-9``; only method ``15`` is restricted to positions ``6-9``.
* German checksum method ``11``: a computed check digit of ``11`` now maps to ``0``
  instead of being compared against as a two-digit value.
* Updated bank registries for Germany, Poland, France and Ireland.

Deviations from upstream
~~~~~~~~~~~~~~~~~~~~~~~~
* Upstream ``2026.07.2`` made ``IBANSpec.positions`` always fully populated, which turned
  its "no positional layout" fast path into dead code. In upstream ``2026.07.3``
  ``BBAN.random`` therefore returns an all-zero BBAN for the seven countries the registry
  has no layout for (``AO``, ``GW``, ``HN``, ``IR``, ``KM``, ``MG``, ``MZ``). This port
  keeps generating those from the BBAN regex, as before.


``2026.03.0`` - 2026/03/06
--------------------------

Initial release. Pure TypeScript port of `schwifty <https://github.com/mdomke/schwifty>`_
``2026.03.0``.

Ported from Python
~~~~~~~~~~~~~~~~~~
* Full IBAN validation (check-digits, country format, length)
* Full BIC validation (ISO 9362 and SWIFT compliance modes)
* IBAN/BIC generation from components
* Random IBAN generation
* BIC lookup from domestic bank code
* All country-specific national checksum algorithms (Germany, Belgium, France, Italy, Spain, Norway,
  Finland, Estonia, Czech Republic, Iceland, Poland, and others)
* Complete bank registry data (same JSON source as Python package)
* SEPA zone detection
* All BBAN component accessors

TypeScript-specific
~~~~~~~~~~~~~~~~~~~
* Zero runtime dependencies
* ESM-only package
* Full type definitions included
