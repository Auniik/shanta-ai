export function printProfile(profile: any, verbose: boolean = false): void {
  if (verbose) {
    printVerboseProfile(profile);
  } else {
    printBasicProfile(profile);
  }
  console.log('');
}

function printBasicProfile(profile: any): void {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                    PROFILE INFORMATION                     ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Name:           ${formatField(profile.surname || 'N/A')}`);
  console.log(`║ Account Code:   ${formatField(profile.accountCode || 'N/A')}`);
  console.log(`║ Email:          ${formatField(profile.email || 'N/A')}`);
  console.log(`║ Phone:          ${formatField(profile.phone || 'N/A')}`);
  console.log(`║ BO ID:          ${formatField(profile.boId || 'N/A')}`);
  console.log(`║ Customer Type:  ${formatField(profile.customerType || 'N/A')}`);
  console.log(`║ Role:           ${formatField(profile.role?.name || 'N/A')}`);
  console.log(`║ Cash Balance:   ${formatField(`৳ ${profile.cash?.toFixed(2) || '0.00'}`)}`);
  console.log(`║ Status:         ${formatField(profile.isActive ? '✓ Active' : '✗ Inactive')}`);
  console.log('╚════════════════════════════════════════════════════════════╝');
}

function printVerboseProfile(profile: any): void {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               DETAILED PROFILE INFORMATION                 ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log(`║ Name:           ${formatField(profile.surname || 'N/A')}`);
  console.log(`║ Account Code:   ${formatField(profile.accountCode || 'N/A')}`);
  console.log(`║ Email:          ${formatField(profile.email || 'N/A')}`);
  console.log(`║ Phone:          ${formatField(profile.phone || 'N/A')}`);
  console.log(`║ BO ID:          ${formatField(profile.boId || 'N/A')}`);
  console.log(`║ National ID:    ${formatField(profile.nationalId || 'N/A')}`);
  console.log(`║ Tax ID:         ${formatField(profile.taxId || 'N/A')}`);
  console.log(`║ Customer Type:  ${formatField(profile.customerType || 'N/A')}`);
  console.log(`║ Role:           ${formatField(profile.role?.name || 'N/A')}`);
  console.log(`║ Role Created:   ${formatField(profile.role?.createdAt ? new Date(profile.role.createdAt).toLocaleDateString() : 'N/A')}`);
  console.log(`║ Cash Balance:   ${formatField(`৳ ${profile.cash?.toFixed(2) || '0.00'}`)}`);
  console.log(`║ Status:         ${formatField(profile.isActive ? '✓ Active' : '✗ Inactive')}`);
  
  const address = profile.address || {};
  const addressLine = address.address1 || 'N/A';
  console.log('╠════════════════════════════════════════════════════════════╣');
  if (addressLine.length > 42) {
    const lines = wrapText(addressLine, 42);
    lines.forEach((line, index) => {
      if (index === 0) {
        console.log(`║ Address:        ${formatField(line)}`);
      } else {
        console.log(`║                 ${formatField(line)}`);
      }
    });
  } else {
    console.log(`║ Address:        ${formatField(addressLine)}`);
  }
  
  console.log('╠════════════════════════════════════════════════════════════╣');
  console.log('║                      BANK DETAILS                          ║');
  console.log('╠════════════════════════════════════════════════════════════╣');
  
  const bank = profile.bank || {};
  console.log(`║ Bank Name:      ${formatField(bank.name || 'N/A')}`);
  console.log(`║ Branch:         ${formatField(bank.branchName || 'N/A')}`);
  console.log(`║ Account No:     ${formatField(bank.accountNumber || 'N/A')}`);
  console.log(`║ Routing No:     ${formatField(bank.routingNumber || 'N/A')}`);
  console.log('╚════════════════════════════════════════════════════════════╝');
}

function formatField(value: string, width: number = 42): string {
  const padding = ' '.repeat(Math.max(0, width - value.length));
  return `${value}${padding} ║`;
}

function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if ((currentLine + word).length <= maxWidth) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) lines.push(currentLine);
  
  return lines;
}
