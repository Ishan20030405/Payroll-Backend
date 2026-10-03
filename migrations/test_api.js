const http = require('http');
const jwt = require('jsonwebtoken');

const token = jwt.sign({ id: 1, role: 'ADMIN' }, 'your_super_secret_jwt_key_123456789', { expiresIn: '1h' });

const postData = JSON.stringify({
  employee_id: "E009",
  date: "2026-08-05",
  check_in: "05:45",
  check_out: "17:43",
  working_hours: 11.97,
  overtime: 3.97,
  status: "Present"
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/attendance',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData),
    'Authorization': 'Bearer ' + token
  }
};

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  let data = '';
  res.on('data', (chunk) => { data += chunk; });
  res.on('end', () => {
    console.log(`BODY: ${data}`);
    process.exit(0);
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
  process.exit(1);
});

req.write(postData);
req.end();

