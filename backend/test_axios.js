const axios = require('axios');
const fs = require('fs');

async function testDelete() {
  try {
    const token = fs.readFileSync('token.txt', 'utf8').trim();
    
    // Create token
    const createRes = await axios.post('http://127.0.0.1:8000/api/api-tokens', {
      name: 'TestRevoke'
    }, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
    });
    const tokenId = createRes.data.data.id;
    console.log("Created token ID: " + tokenId);
    
    // Delete token
    const deleteRes = await axios.delete('http://127.0.0.1:8000/api/api-tokens/' + tokenId, {
      headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
    });
    console.log("Delete status: " + deleteRes.status);
    console.log("Delete response: ", deleteRes.data);
    
  } catch (e) {
    console.error("Error: ", e.response ? e.response.data : e.message);
  }
}

testDelete();
