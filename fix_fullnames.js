// Utility script to fix incorrectly mapped full names
const axios = require('axios');

async function fixFullNames() {
  try {
    console.log('🔧 Starting full name fix process...');
    
    // Get all contacts
    const response = await axios.get('http://localhost:5000/api/contacts');
    const contacts = response.data.contacts;
    
    console.log(`📊 Found ${contacts.length} total contacts`);
    
    let fixedCount = 0;
    let issuesFound = 0;
    
    for (const contact of contacts) {
      const { id, fullName, firstName, lastName } = contact;
      
      // Check if fullName looks like a hex ID or is incorrectly mapped
      const isHexId = /^[a-f0-9]{24}$/.test(fullName);
      const shouldBeUpdated = isHexId || 
        (firstName && lastName && fullName !== `${firstName} ${lastName}`) ||
        (firstName && !lastName && fullName !== firstName) ||
        (!firstName && lastName && fullName !== lastName) ||
        (!fullName && (firstName || lastName));
      
      if (shouldBeUpdated) {
        issuesFound++;
        
        // Generate correct full name
        let correctFullName = '';
        if (firstName && lastName) {
          correctFullName = `${firstName.trim()} ${lastName.trim()}`;
        } else if (firstName) {
          correctFullName = firstName.trim();
        } else if (lastName) {
          correctFullName = lastName.trim();
        }
        
        if (correctFullName && correctFullName !== fullName) {
          console.log(`🔄 Fixing: "${fullName}" → "${correctFullName}" (${contact.email})`);
          
          try {
            await axios.patch(`http://localhost:5000/api/contacts/${id}`, {
              fullName: correctFullName
            });
            fixedCount++;
          } catch (error) {
            console.error(`❌ Failed to fix contact ${id}:`, error.response?.data || error.message);
          }
        }
      }
    }
    
    console.log(`\n✅ Fix complete:`);
    console.log(`   Issues found: ${issuesFound}`);
    console.log(`   Successfully fixed: ${fixedCount}`);
    
  } catch (error) {
    console.error('❌ Error during fix process:', error.message);
  }
}

fixFullNames();