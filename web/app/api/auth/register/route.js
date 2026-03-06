const { NextResponse } = require('next/server');

async function POST() {
  return NextResponse.json({ error: 'Registration is disabled' }, { status: 405 });
}

module.exports = { POST };
