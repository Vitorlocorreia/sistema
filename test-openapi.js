const fs = require('fs');
async function getOpenAPI() {
  const url = 'https://xqackyuxipcxvmliecow.supabase.co/rest/v1/?apikey=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhxYWNreXV4aXBjeHZtbGllY293Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM4NzgwODMsImV4cCI6MjA5OTQ1NDA4M30.Xv316dO_8QrCpnIqTkcodq_wkuU93ESE8ZOJF5ajFSk';
  const response = await fetch(url);
  const data = await response.text();
  fs.writeFileSync('openapi.json', data);
  console.log("Done");
}
getOpenAPI();
