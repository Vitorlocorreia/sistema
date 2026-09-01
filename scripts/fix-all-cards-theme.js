const fs = require('fs');
const path = require('path');

// 1. Update app/(portal)/rh/page.tsx
{
  const filePath = path.join(__dirname, '..', 'app', '(portal)', 'rh', 'page.tsx');
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix unselected invite background and borders
  content = content.replace(
    /background: selectedInvite\?\.id === invite\.id \? '#F59E0B18' : '#0B0C0E'/g,
    `background: selectedInvite?.id === invite.id ? C.amberDim : C.bgPanel`
  );

  content = content.replace(
    /background: selectedInvite\?\.id === invite\.id \? '#F59E0B12' : '#0B0C0E'/g,
    `background: selectedInvite?.id === invite.id ? C.amberDim : C.bgPanel`
  );

  content = content.replace(
    /background: '#0B0C0E'/g,
    `background: C.bgPanel`
  );

  content = content.replace(
    /background: '#12141C'/g,
    `background: C.bgPanel`
  );

  // Fix card text colors
  content = content.replace(
    /<strong style=\{\{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' \}\}>/g,
    `<strong style={{ fontSize: 13, fontWeight: 900, color: C.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>`
  );

  // Fix Prorrogar button
  content = content.replace(
    /style=\{\{ border: `1px solid \$\{C\.border\}`, background: 'transparent', color: C\.ink, borderRadius: 4, padding: '3px 8px', fontSize: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 \}\}/g,
    `style={{ border: \`1px solid \${C.border}\`, background: C.bgWhite, color: C.ink, borderRadius: 4, padding: '4px 10px', fontSize: 10, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}`
  );

  fs.writeFileSync(filePath, content, 'utf8');
  console.log('RH Page overhauled with light high-contrast cards!');
}

// 2. Update app/(portal)/suprimentos/page.tsx
{
  const filePath = path.join(__dirname, '..', 'app', '(portal)', 'suprimentos', 'page.tsx');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/background: '#0B0C0E'/g, `background: C.bgCard`);
    content = content.replace(/background: '#16181C'/g, `background: C.bgWhite`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Suprimentos page updated!');
  }
}

// 3. Update app/(portal)/obras/page.tsx
{
  const filePath = path.join(__dirname, '..', 'app', '(portal)', 'obras', 'page.tsx');
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(/background: '#0B0C0E'/g, `background: C.bgCard`);
    content = content.replace(/background: '#12141C'/g, `background: C.bgPanel`);
    content = content.replace(/background: '#16181C'/g, `background: C.bgWhite`);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log('Obras page updated!');
  }
}
