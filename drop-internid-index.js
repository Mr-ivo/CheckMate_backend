require('dotenv').config();
const mongoose = require('mongoose');

async function dropIndex() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('interns');

    // List all indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`   - ${idx.name}:`, JSON.stringify(idx.key));
    });

    // Drop the internId_1 index
    try {
      await collection.dropIndex('internId_1');
      console.log('\n✅ Dropped internId_1 index successfully');
    } catch (error) {
      if (error.code === 27) {
        console.log('\n⏭️  Index internId_1 does not exist (already dropped)');
      } else {
        throw error;
      }
    }

    // List indexes after dropping
    const indexesAfter = await collection.indexes();
    console.log('\n📋 Indexes after drop:');
    indexesAfter.forEach(idx => {
      console.log(`   - ${idx.name}:`, JSON.stringify(idx.key));
    });

    console.log('\n✅ Done!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

dropIndex();
