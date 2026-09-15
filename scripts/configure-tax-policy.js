'use strict';
// Direct DB installation is retired: registration changes require authenticated
// actor attribution, a current review, an atomic audit and reopening approval.
process.stderr.write('Use the SUPER_ADMIN Pricing Approvals screen or authenticated billing-approval API. No policy was changed.\n');
process.exitCode = 2;
