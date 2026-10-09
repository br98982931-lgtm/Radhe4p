const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Dealer = require('../models/Dealer');
const DiamondType = require('../models/DiamondType');
const DiamondPrice = require('../models/DiamondPrice');

const path = require('path');

dotenv.config({ path: path.join(__dirname, '..', '.env') });

async function seedDatabase() {
    try {
        // Connect to MongoDB
        
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Clear existing data
        await User.deleteMany({});
        await Dealer.deleteMany({});
        await DiamondType.deleteMany({});
        await DiamondPrice.deleteMany({});
        console.log('🗑️  Cleared existing data');

        // Create Manager
        const manager = new User({
            name: 'Manager',
            email: 'manager@radhe4p.com',
            password: 'manager123',
            role: 'manager'
        });
        await manager.save();
        console.log('✅ Created manager account');

        // Create Worker
        const worker1 = new User({
            name: 'Worker',
            email: 'worker@radhe4p.com',
            password: 'worker123',
            role: 'worker'
        });
        await worker1.save();
        console.log('✅ Created worker account');

        // Create Dealers
        const dealer1 = new Dealer({
            name: 'Diamond Enterprises',
            contactInfo: '+91 98765 43210',
            createdBy: manager._id
        });
        await dealer1.save();

        const dealer2 = new Dealer({
            name: 'Precious Gems Co.',
            contactInfo: '+91 98765 11111',
            createdBy: manager._id
        });
        await dealer2.save();

        const dealer3 = new Dealer({
            name: 'Royal Diamonds',
            contactInfo: '+91 98765 22222',
            createdBy: manager._id
        });
        await dealer3.save();
        console.log('✅ Created dealers');

        // Create Diamond Types
        const type1 = new DiamondType({
            name: 'Round Cut',
            description: 'Classic round brilliant cut diamonds'
        });
        await type1.save();

        const type2 = new DiamondType({
            name: 'Princess Cut',
            description: 'Square or rectangular brilliant cut'
        });
        await type2.save();

        const type3 = new DiamondType({
            name: 'Emerald Cut',
            description: 'Rectangular step cut'
        });
        await type3.save();

        const type4 = new DiamondType({
            name: 'Oval Cut',
            description: 'Elongated round brilliant cut'
        });
        await type4.save();
        console.log('✅ Created diamond types');

        // Create Sample Prices
        const prices = [
            { dealer: dealer1._id, diamondType: type1._id, pricePerDiamond: 50 },
            { dealer: dealer1._id, diamondType: type2._id, pricePerDiamond: 55 },
            { dealer: dealer2._id, diamondType: type1._id, pricePerDiamond: 48 },
            { dealer: dealer2._id, diamondType: type3._id, pricePerDiamond: 60 },
            { dealer: dealer3._id, diamondType: type1._id, pricePerDiamond: 52 },
            { dealer: dealer3._id, diamondType: type4._id, pricePerDiamond: 58 },
        ];

        await DiamondPrice.insertMany(prices);
        console.log('✅ Created sample prices');

        console.log('\n🎉 Database seeded successfully!');
        console.log('\nDefault Credentials:');
        console.log('Manager: manager@radhe4p.com / manager123');
        console.log('Worker: worker@radhe4p.com / worker123');
        console.log('Worker 2: priya@radhe4p.com / worker123');

        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    } catch (error) {
        console.error('❌ Error seeding database:', error);
        process.exit(1);
    }
}

seedDatabase();
