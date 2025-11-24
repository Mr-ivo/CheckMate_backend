/**
 * Script to convert old base64 credential IDs to base64url format
 * Run this ONCE to fix existing credentials
 */

const mongoose = require('mongoose');

// MongoDB connection string - UPDATE THIS!
const MONGODB_URI = process.env.MONGODB_URI || 'YOUR_MONGODB_URI_HERE';

const webauthnCredentialSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId,
  credentialId: String,
  publicKey: String,
  counter: Number,
  deviceType: String,
  aaguid: String,
  credentialBackedUp: Boolean,
  name: String,
  deviceInfo: Object,
  transports: [String],
  usageCount: Number,
  lastUsed: Date,
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
});

const WebAuthnCredential = mongoose.model('WebAuthnCredential', webauthnCredentialSchema);

async function convertCredentials() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find all credentials
    const allCredentials = await WebAuthnCredential.find({});
    console.log(`📝 Found ${allCredentials.length} credential(s)\n`);

    let convertedCount = 0;
    let skippedCount = 0;

    for (const cred of allCredentials) {
      const oldId = cred.credentialId;
      
      // Check if it's already base64url (no padding, no +/)
      const isBase64 = oldId.includes('=') || oldId.includes('+') || oldId.includes('/');
      
      if (isBase64) {
        try {
          // Convert: base64 → bytes → base64url
          const bytes = Buffer.from(oldId, 'base64');
          const newId = bytes.toString('base64url');
          
          console.log(`🔄 Converting credential: ${cred.name}`);
          console.log(`   Old (base64):    ${oldId.substring(0, 40)}...`);
          console.log(`   New (base64url): ${newId.substring(0, 40)}...`);
          
          // Update in database
          await WebAuthnCredential.updateOne(
            { _id: cred._id },
            { $set: { credentialId: newId } }
          );
          
          console.log(`   ✅ Converted!\n`);
          convertedCount++;
        } catch (error) {
          console.error(`   ❌ Error converting ${cred.name}:`, error.message);
        }
      } else {
        console.log(`⏭️  Skipping ${cred.name} - already base64url format`);
        skippedCount++;
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`   ✅ Converted: ${convertedCount}`);
    console.log(`   ⏭️  Skipped: ${skippedCount}`);
    console.log(`   📝 Total: ${allCredentials.length}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Disconnected from MongoDB');
    console.log('\n🎉 Done! You can now use Face ID check-in.');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

// Check if MONGODB_URI is set
if (MONGODB_URI === 'YOUR_MONGODB_URI_HERE') {
  console.error('❌ ERROR: Please set MONGODB_URI in the script or as environment variable');
  console.error('   Example: MONGODB_URI="mongodb+srv://..." node convert-credentials.js');
  process.exit(1);
}

convertCredentials();
