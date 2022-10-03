[![js.org](https://img.shields.io/badge/js.org-+-FFE70B.svg?style=flat-square)](http://js.org)
[![Donate](https://img.shields.io/badge/Donate-for_registrar_fees-1F87FF.svg?style=flat-square&logo=open-collective&logoColor=fff)](https://opencollective.com/js-org)

## Cleanup Scripts

These are the scripts behind the annual js.org cleanup process.

### CLI

These scripts operate as a small CLI tool, by running `node index.js`.

There are four options within the CLI:

- `--perfect`                     : Generates a perfectly formatted and sorted cnames_active file
- `--main-issue`                  : Initiates the annual cleanup by creating the main cleanup issue
- `--main-pr <issueNumber>`       : Completes the annual cleanup by parsing issue and creating PR
- `--validate <filePath> [--fix]` : Validates a given cnames_active file for perfect formatting

When using `--perfect`, `--main-issue`, or `--main-pr`, you will need to have a `config.json` file
created in the root of the repository following `config.example.json`.

If you are using `--validate`, then no config is needed as this operates against a given local file
path rather than using the GitHub API. This option can also be passed a `--fix` flag after the file
path to automatically fix any violations.

### Examples

#### Generated Main Issue

https://github.com/js-org-cleanup/simulated-js.org/issues/46

#### Generated Contact Issue

https://github.com/js-org-cleanup/simulated-automatic-contact/issues/12

#### Generated Pull Request

https://github.com/js-org-cleanup/simulated-js.org/pull/47
