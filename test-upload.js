// Simple test script to check if upload API is working
const fs = require('fs');
const path = require('path');

async function testUpload() {
  try {
    // Create a simple test file
    const testContent = 'Test PDF content';
    const testFile = new Blob([testContent], { type: 'application/pdf' });
    
    const formData = new FormData();
    formData.append('file', testFile, 'test.pdf');
    formData.append('documentName', 'Test Document');
    
    console.log('Sending test upload request...');
    
    const response = await fetch('http://localhost:3000/api/llamaparse', {
      method: 'POST',
      body: formData,
    });
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers));
    
    const data = await response.json();
    console.log('Response data:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

testUpload();
