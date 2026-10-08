# GRA PIT Calculator

WordPress plugin for a Ghana Revenue Authority Personal Income Tax page. The visitor enters basic income, allowances, and tax relief. The calculator deducts employee SSNIT at 5.5% of basic income, then applies the Year of Assessment 2026 resident individual bands. Those rates took effect on 1 September 2026 under the Income Tax (Amendment) Act, 2026 (Act 1178). Income above GH¢50,000 a month or GH¢600,000 a year is taxed at 35%.

The shortcode is:

```
[pit_calculator]
```

The shortcode does not change between versions. After an update, existing pages keep working.

Repository: https://github.com/chillboy0101/gra-pit-calculator

Author: GRA IT Department (https://gra.gov.gh)

Maintainer: Carl Quist (https://github.com/chillboy0101)

Official bands: https://gra.gov.gh/domestic-tax/tax-types/paye/

The PIT page is https://gra.gov.gh/domestic-tax/personal-income-tax/. GRA publishes the resident individual monthly and annual tables on the PAYE page. The slices in `assets/app.js` match that Year of Assessment 2026 table.

## What a visitor can do

The form has two modes.

- **Monthly.** Enter monthly basic income, monthly allowances, and monthly tax relief.
- **Annual.** Enter the same figures for the year. The annual 2026 bands are used.

Allowances are added to chargeable income. Tax relief is subtracted. Employee SSNIT is 5.5% of basic income and is subtracted before tax. Net income is basic income plus allowances, minus SSNIT and income tax.

The band table shows each slice, the rate, the tax on that slice, the cumulative income, and the cumulative tax.

## What the plugin does not store

The calculation runs in the visitor's browser. Income figures and results are not sent to WordPress, to GRA, or to GitHub. The plugin has no accounts, no database tables, and no settings that hold taxpayer information.

## Install

1. Download `gra-pit-calculator.zip` from the latest release.
2. In WordPress, go to Plugins → Add New → Upload Plugin and choose that zip.
3. Activate **GRA PIT Calculator**.
4. Put `[pit_calculator]` in a page. On the Financity / Goodlayers builder, use a Text or Shortcode element.

The zip must contain a folder named `gra-pit-calculator` with `gra-pit-calculator.php` inside it. Do not install GitHub's automatic "Source code" zip. That zip uses a different folder name and WordPress will not treat it as this plugin.

`index.html` in the project folder is a local preview. It is not part of the plugin zip.

## Updates

The plugin header contains:

```
Update URI: https://github.com/chillboy0101/gra-pit-calculator
```

WordPress asks GitHub for the latest release. If the release version is higher than the installed version, Plugins shows an update. The download address must be exactly:

```
https://github.com/chillboy0101/gra-pit-calculator/releases/download/vX.Y.Z/gra-pit-calculator.zip
```

`X.Y.Z` is the version in the plugin file, and the tag must be `vX.Y.Z`. Any other address is ignored. The plugin does not use a token, does not log into GitHub, and does not follow a download link that points anywhere else.

Click **Enable auto-updates** on the Plugins screen if a new release should install itself. Leave it off if a person should press Update after looking at the release. Auto-updates install whatever zip is attached to the newest trusted release, so publish a release only after the zip has been checked.

On the live GRA site, install the reviewed zip once and leave Enable auto-updates off.

This repository is **public**. It has to be public so WordPress can download the zip without a password stored on the website. The code and the tax rates are public information. The repository must not be made private unless the update checker is redesigned, because a private repository would stop updates.

## Security rules

Protect the GitHub account `chillboy0101`. Turn on two-factor authentication. Do not share the password. A person who can publish a release can ship code to every site that has auto-updates turned on.

Never commit any of these:

- WordPress passwords, database passwords, or `wp-config.php`
- GitHub tokens, personal access tokens, or SSH private keys
- Taxpayer names, TINs, salaries, or calculator results
- A copy of the live GRA website, its uploads, or its database

The calculation does not phone home. The only network call the plugin makes is the WordPress admin update check to `https://api.github.com/repos/chillboy0101/gra-pit-calculator/releases/latest`. Visitors who use the calculator do not trigger that call.

Before you publish a release, open the zip and confirm it contains `gra-pit-calculator/gra-pit-calculator.php` and `gra-pit-calculator/includes/class-github-updater.php`, and that it does not contain a `.git` folder.

## Publish a new version

1. Change both `Version:` and `const VERSION` in `gra-pit-calculator.php` to the same new number, such as `1.0.13`.
2. Copy the preview `app.js` and `styles.css` into `assets/` after editing them.
3. From this folder, run `bash build-zip.sh`. It writes `dist/gra-pit-calculator.zip` and refuses to include `.git`.
4. Commit the version change and push it to `main`.
5. Create a GitHub release. The tag must be `v` plus the version, for example `v1.0.13`.
6. Attach the zip. Its file name must stay `gra-pit-calculator.zip`.
7. On a site that has the plugin, open Plugins and use Check again if the update is not listed yet. The check is cached for 30 minutes.

Do not attach a second zip with a different name. The plugin accepts only `gra-pit-calculator.zip`.
