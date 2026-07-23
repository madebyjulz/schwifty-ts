.. _changelog:

Changelog
=========

Versions follow the upstream `schwifty <https://github.com/mdomke/schwifty>`_ Python package using
`CalVer <http://www.calver.org/>`_ with the scheme ``YY.0M.Micro``. Patch-level increments
(e.g. ``2026.03.0-1``) are reserved for TypeScript-specific fixes only.

For the full upstream changelog see the
`schwifty changelog <https://github.com/mdomke/schwifty/blob/main/CHANGELOG.rst>`_.

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
