const data = JSON.stringify({ email: 'admin@jmc.edu.ph', password: 'password123' });

fetch('http://127.0.0.1:8000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  body: data
})
.then(res => res.json())
.then(json => console.log(json))
.catch(err => console.error(err));
