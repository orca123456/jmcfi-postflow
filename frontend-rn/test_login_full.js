// Simulates the exact same login flow as the frontend store/auth.ts
const data = JSON.stringify({ email: 'admin@jmc.edu.ph', password: 'password123' });

fetch('http://127.0.0.1:8000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Origin': 'http://localhost:8081'
  },
  body: data
})
.then(async res => {
  console.log('HTTP Status:', res.status);
  console.log('CORS Allow-Origin:', res.headers.get('access-control-allow-origin'));
  console.log('CORS Allow-Credentials:', res.headers.get('access-control-allow-credentials'));
  const json = await res.json();
  console.log('\nResponse body:');
  console.log(JSON.stringify(json, null, 2));

  // Simulate what auth.ts does
  if (json.user && json.token) {
    let { token, user } = json;
    const roleMap = {
      'content_requestor': 'requestor',
      'it_admin': 'it_publisher',
      'admin': 'it_publisher',
    };
    const rawRole = user.roles?.[0];
    user.role = roleMap[rawRole] ?? rawRole;
    if (!user.name && user.first_name) {
      user.name = `${user.first_name} ${user.last_name}`;
    }

    const dashMap = {
      requestor: '/dashboard/requestor',
      office_head: '/dashboard/office-head',
      vice_president: '/dashboard/vp',
      imc_qa_checker: '/dashboard/imc-qa',
      it_publisher: '/dashboard/it-admin',
      admin: '/dashboard/it-admin',
    };
    const redirect = dashMap[user.role] ?? '/dashboard/requestor';

    console.log('\n--- Frontend simulation ---');
    console.log('Raw role from API:', rawRole);
    console.log('Mapped role:', user.role);
    console.log('Would redirect to:', redirect);
  }
})
.catch(err => {
  console.error('Error:', err.message);
});
