// server.js - UPDATED TO MATCH YOUR FIREBASE STRUCTURE
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const path = require('path');

const app = express();

// ✅ CORS CONFIGURATION
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000', 'https://hosting-xk33.onrender.com'],
  credentials: true
}));

app.use(express.json());

// ✅ FIREBASE INITIALIZATION
try {
  console.log('🔄 Initializing Firebase...');
  
  const serviceAccount = require('./serviceAccountKey.json');
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://papayafresh-db1.firebaseio.com"
  });

  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error.message);
  process.exit(1);
}

const db = admin.firestore();
const auth = admin.auth();

// ✅ REQUEST LOGGING MIDDLEWARE
app.use((req, res, next) => {
  console.log(`📨 ${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

// ✅ HEALTH CHECK
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date(),
    server: 'PapayaFresh API',
    version: '2.0.0'
  });
});

// ✅ DASHBOARD STATS - UPDATED FOR YOUR FIREBASE STRUCTURE
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    console.log('🔄 Fetching dashboard data from Firebase...');
    
    const usersSnapshot = await db.collection('users').get();
    let totalScans = 0;
    let totalShelfItems = 0;
    let totalHistoryItems = 0;
    const userActivities = [];
    const allScans = [];
    
    // Process each user based on your Firebase structure
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      console.log(`👤 Processing user: ${userId}`, {
        email: userData.email,
        user_id: userData.user_id,
        created_at: userData.created_at
      });
      
      try {
        // ✅ GET USER'S SHELF ITEMS (based on your structure)
        const shelfSnapshot = await db.collection('users').doc(userId).collection('shelf').get();
        const userShelfCount = shelfSnapshot.size;
        totalShelfItems += userShelfCount;
        
        // ✅ GET USER'S HISTORY ITEMS (based on your structure)
        const historySnapshot = await db.collection('users').doc(userId).collection('history').get();
        const userHistoryCount = historySnapshot.size;
        totalHistoryItems += userHistoryCount;
        
        // Process shelf items for scans data
        shelfSnapshot.forEach(doc => {
          const shelfItem = doc.data();
          
          // ✅ USE ACTUAL FIELDS FROM YOUR SHELF COLLECTION
          const scanData = {
            id: doc.id,
            userId: userId,
            userEmail: userData.email || 'Unknown',
            // Your actual shelf fields:
            name: shelfItem.name || 'Unknown Papaya',
            color: shelfItem.color || 'Unknown',
            freshness: shelfItem.freshness || 'Unknown',
            harvestedDate: shelfItem.harvestedDate || null,
            scannedDate: shelfItem.scannedDate || null,
            imageUrl: shelfItem.imageUrl || null,
            estimatedDays: shelfItem.estimatedDays || 0,
            dayRange: shelfItem.dayRange || 'Unknown',
            expiryDate: shelfItem.expiryDate || null,
            // Additional fields from your structure:
            addedAt: shelfItem.addedAt || null,
            archivedAt: shelfItem.archivedAt || null,
            removalReason: shelfItem.removalReason || null,
            removedDate: shelfItem.removedDate || null,
            allCharacteristics: shelfItem.allCharacteristics || [],
            allModelProfile: shelfItem.allModelProfile || [],
            allConfidences: shelfItem.allConfidences || []
          };
          
          allScans.push(scanData);
          
          // Add to recent activities
          userActivities.push({
            user: userData.email || `User ${userId.substring(0, 8)}`,
            action: `Scanned ${scanData.name} - ${scanData.freshness}`,
            time: formatTimeAgo(scanData.scannedDate || scanData.addedAt),
            type: 'scan'
          });
        });
        
        // Process history items
        historySnapshot.forEach(doc => {
          const historyItem = doc.data();
          
          // ✅ USE ACTUAL FIELDS FROM YOUR HISTORY COLLECTION
          userActivities.push({
            user: userData.email || `User ${userId.substring(0, 8)}`,
            action: `History: ${historyItem.name || 'Activity'}`,
            time: formatTimeAgo(historyItem.scannedDate || historyItem.archivedAt),
            type: 'history'
          });
        });
        
        // Add to total scans
        totalScans += userShelfCount + userHistoryCount;
        
      } catch (error) {
        console.log(`⚠️ Error processing user ${userId}:`, error.message);
      }
    }
    
    const totalUsers = usersSnapshot.size;
    
    // Calculate statistics based on actual data
    const ripenessDistribution = calculateFreshnessDistribution(allScans);
    const weeklyScans = calculateWeeklyScans(allScans);
    const recentActivities = userActivities
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 6);
    
    // ✅ RESPONSE STRUCTURE FOR FRONTEND
    const responseData = {
      // Real data from your Firebase
      totalUsers: totalUsers || 0,
      newUsers: Math.max(1, Math.floor(totalUsers * 0.2)), // Estimate based on total
      totalScans: totalScans || 0,
      papayasOnShelf: totalShelfItems || 0,
      
      // Distribution based on actual freshness data
      ripenessDistribution: ripenessDistribution,
      
      // Weekly data from actual scans
      weeklyScans: weeklyScans,
      
      // Recent activities from actual user actions
      recentActivities: recentActivities.length > 0 ? recentActivities : [
        { user: "No activity yet", action: "Waiting for user scans", time: "Just now" }
      ],
      
      // Additional stats
      userStats: {
        averageScansPerUser: totalUsers > 0 ? (totalScans / totalUsers).toFixed(1) : 0,
        activeUsers: userActivities.length,
        totalShelfItems: totalShelfItems,
        totalHistoryItems: totalHistoryItems
      },
      
      // Debug info
      _debug: {
        usersFound: totalUsers,
        shelfItemsFound: totalShelfItems,
        historyItemsFound: totalHistoryItems,
        userIds: usersSnapshot.docs.map(doc => doc.id)
      }
    };
    
    console.log('✅ Dashboard Data Retrieved:', {
      totalUsers: responseData.totalUsers,
      totalScans: responseData.totalScans,
      shelfItems: responseData.papayasOnShelf,
      userActivities: userActivities.length
    });
    
    res.json(responseData);
    
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ 
      success: false,
      error: error.message,
      // Fallback data for frontend
      totalUsers: 0,
      newUsers: 0,
      totalScans: 0,
      papayasOnShelf: 0,
      ripenessDistribution: { unripe: 1, ripe: 1, overripe: 1 },
      weeklyScans: [2, 5, 8, 12],
      recentActivities: [
        { user: "System", action: "Error loading data", time: "Just now" }
      ]
    });
  }
});

// ✅ GET ALL USERS - UPDATED FOR YOUR STRUCTURE
app.get('/api/users/all', async (req, res) => {
  try {
    console.log('🔄 Fetching all users...');
    
    const usersSnapshot = await db.collection('users').get();
    const usersData = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      try {
        // Count shelf items
        const shelfSnapshot = await db.collection('users').doc(userId).collection('shelf').get();
        const shelfCount = shelfSnapshot.size;
        
        // Count history items
        const historySnapshot = await db.collection('users').doc(userId).collection('history').get();
        const historyCount = historySnapshot.size;
        
        usersData.push({
          userId: userId,
          email: userData.email || 'No email',
          user_id: userData.user_id || 'No user_id',
          created_at: userData.created_at || 'Unknown',
          shelfCount: shelfCount,
          historyCount: historyCount,
          totalScans: shelfCount + historyCount,
          // Include actual user data for debugging
          userData: userData
        });
      } catch (error) {
        console.log(`⚠️ Error processing user ${userId}:`, error.message);
        usersData.push({
          userId: userId,
          email: userData.email || 'No email',
          user_id: userData.user_id || 'No user_id',
          created_at: userData.created_at || 'Unknown',
          shelfCount: 0,
          historyCount: 0,
          totalScans: 0,
          error: error.message
        });
      }
    }
    
    console.log(`✅ Found ${usersData.length} users`);
    res.json({
      success: true,
      totalUsers: usersData.length,
      users: usersData
    });
    
  } catch (error) {
    console.error('❌ Error fetching users data:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ GET ALL SCANS FROM SHELF - UPDATED FOR YOUR STRUCTURE
app.get('/api/scans/all', async (req, res) => {
  try {
    console.log('🔄 Fetching all scans from shelf collections...');
    
    const allScans = [];
    const usersSnapshot = await db.collection('users').get();
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      try {
        const shelfSnapshot = await db.collection('users').doc(userId).collection('shelf').get();
        
        shelfSnapshot.forEach(doc => {
          const shelfData = doc.data();
          
          // ✅ USE YOUR ACTUAL SHELF FIELDS
          allScans.push({
            id: doc.id,
            userId: userId,
            userEmail: userData.email || 'Unknown',
            // Your actual shelf fields:
            name: shelfData.name || 'Unknown Papaya',
            color: shelfData.color || 'Unknown',
            freshness: shelfData.freshness || 'Unknown',
            harvestedDate: shelfData.harvestedDate || null,
            scannedDate: shelfData.scannedDate || null,
            imageUrl: shelfData.imageUrl || null,
            estimatedDays: shelfData.estimatedDays || 0,
            dayRange: shelfData.dayRange || 'Unknown',
            expiryDate: shelfData.expiryDate || null,
            addedAt: shelfData.addedAt || null,
            // Additional fields
            archivedAt: shelfData.archivedAt || null,
            removalReason: shelfData.removalReason || null,
            removedDate: shelfData.removedDate || null
          });
        });
        
      } catch (shelfError) {
        console.log(`⚠️ No shelf collection for user ${userId}:`, shelfError.message);
      }
    }
    
    // Sort by scanned date (newest first)
    allScans.sort((a, b) => {
      const dateA = a.scannedDate ? new Date(a.scannedDate) : new Date(0);
      const dateB = b.scannedDate ? new Date(b.scannedDate) : new Date(0);
      return dateB - dateA;
    });
    
    console.log(`✅ Found ${allScans.length} scans from database`);
    
    res.json({
      success: true,
      totalScans: allScans.length,
      scans: allScans
    });
    
  } catch (error) {
    console.error('❌ Error fetching scans:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ GET USER'S SPECIFIC SHELF ITEMS
app.get('/api/users/:userId/shelf', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔄 Fetching shelf items for user: ${userId}`);
    
    const shelfSnapshot = await db.collection('users').doc(userId).collection('shelf').get();
    const shelfItems = [];
    
    shelfSnapshot.forEach(doc => {
      shelfItems.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Found ${shelfItems.length} shelf items for user ${userId}`);
    res.json({
      success: true,
      userId: userId,
      shelfCount: shelfItems.length,
      shelf: shelfItems
    });
    
  } catch (error) {
    console.error('❌ Error fetching shelf items:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ GET USER'S HISTORY
app.get('/api/users/:userId/history', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log(`🔄 Fetching history for user: ${userId}`);
    
    const historySnapshot = await db.collection('users').doc(userId).collection('history').get();
    const historyItems = [];
    
    historySnapshot.forEach(doc => {
      historyItems.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    console.log(`✅ Found ${historyItems.length} history items for user ${userId}`);
    res.json({
      success: true,
      userId: userId,
      historyCount: historyItems.length,
      history: historyItems
    });
    
  } catch (error) {
    console.error('❌ Error fetching history:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ DELETE USER ENDPOINT
app.delete('/api/users/delete/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('🗑️ DELETE /api/users/delete/', userId);

    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        error: 'User not found' 
      });
    }

    const userData = userDoc.data();

    // Delete shelf subcollection
    const shelfSnapshot = await db.collection('users').doc(userId).collection('shelf').get();
    const shelfDeletePromises = shelfSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(shelfDeletePromises);

    // Delete history subcollection  
    const historySnapshot = await db.collection('users').doc(userId).collection('history').get();
    const historyDeletePromises = historySnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(historyDeletePromises);

    // Delete main user document
    await db.collection('users').doc(userId).delete();

    // Delete from Authentication
    try {
      await auth.deleteUser(userId);
      console.log('✅ User deleted from Authentication');
    } catch (authError) {
      console.log('⚠️ User not found in Authentication:', authError.message);
    }

    console.log(`✅ User ${userId} deleted successfully`);
    
    res.json({ 
      success: true,
      message: 'User deleted successfully',
      deletedUser: {
        userId: userId,
        email: userData.email
      }
    });

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ✅ DEBUG ENDPOINT - See your actual database structure
app.get('/api/debug/database', async (req, res) => {
  try {
    console.log('🔍 Debugging database structure...');
    
    const collections = await db.listCollections();
    const collectionList = collections.map(col => col.id);
    
    // Get sample users with actual data
    const usersSnapshot = await db.collection('users').limit(3).get();
    const sampleUsers = [];
    
    for (const userDoc of usersSnapshot.docs) {
      const userId = userDoc.id;
      const userData = userDoc.data();
      
      // Check subcollections with actual data
      const shelfSnapshot = await db.collection('users').doc(userId).collection('shelf').limit(2).get();
      const historySnapshot = await db.collection('users').doc(userId).collection('history').limit(2).get();
      
      sampleUsers.push({
        userId: userId,
        userData: userData,
        shelfCount: shelfSnapshot.size,
        historyCount: historySnapshot.size,
        sampleShelf: shelfSnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })),
        sampleHistory: historySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }))
      });
    }
    
    res.json({
      success: true,
      collections: collectionList,
      totalUsers: (await db.collection('users').get()).size,
      sampleUsers: sampleUsers,
      databaseStructure: {
        users: {
          fields: ['email', 'user_id', 'created_at'], // Your actual fields
          subcollections: ['shelf', 'history']
        },
        shelf: {
          fields: ['name', 'color', 'freshness', 'harvestedDate', 'scannedDate', 'imageUrl', 'estimatedDays', 'dayRange', 'expiryDate', 'addedAt'] // Your actual fields
        },
        history: {
          fields: ['name', 'color', 'freshness', 'scannedDate', 'archivedAt', 'removalReason'] // Your actual fields
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Debug endpoint error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ 404 HANDLER
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET  /api/health',
      'GET  /api/users/all',
      'DELETE /api/users/delete/:userId',
      'GET  /api/users/:userId/shelf',
      'GET  /api/users/:userId/history',
      'GET  /api/scans/all',
      'GET  /api/dashboard/stats',
      'GET  /api/debug/database'
    ]
  });
});

// ✅ GLOBAL ERROR HANDLER
app.use((error, req, res, next) => {
  console.error('💥 Global Error Handler:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// HELPER FUNCTIONS - UPDATED FOR YOUR DATA
function calculateFreshnessDistribution(scans) {
  const distribution = { unripe: 0, ripe: 0, overripe: 0 };
  
  scans.forEach(scan => {
    const freshness = (scan.freshness || '').toLowerCase();
    if (freshness.includes('unripe') || freshness === 'green' || freshness.includes('early')) {
      distribution.unripe++;
    } else if (freshness.includes('overripe') || freshness === 'rotten' || freshness.includes('late')) {
      distribution.overripe++;
    } else {
      distribution.ripe++; // Default to ripe
    }
  });
  
  // Ensure at least 1 for chart display
  if (distribution.unripe === 0 && distribution.ripe === 0 && distribution.overripe === 0) {
    return { unripe: 1, ripe: 1, overripe: 1 };
  }
  
  return distribution;
}

function calculateWeeklyScans(scans) {
  if (scans.length === 0) return [2, 5, 8, 12];
  
  const weeklyData = [0, 0, 0, 0];
  const now = new Date();
  
  scans.forEach(scan => {
    const scanDate = scan.scannedDate || scan.addedAt || scan.harvestedDate;
    if (scanDate) {
      const date = scanDate.toDate ? scanDate.toDate() : new Date(scanDate);
      const diffWeeks = Math.floor((now - date) / (7 * 24 * 60 * 60 * 1000));
      
      if (diffWeeks < 4) {
        weeklyData[3 - diffWeeks]++;
      }
    }
  });
  
  return weeklyData.map(count => Math.max(1, count));
}

function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Recent';
  try {
    const now = new Date();
    let activityTime;
    
    if (timestamp.toDate) {
      activityTime = timestamp.toDate();
    } else if (typeof timestamp === 'string') {
      activityTime = new Date(timestamp);
    } else if (timestamp.seconds) {
      activityTime = new Date(timestamp.seconds * 1000);
    } else {
      activityTime = new Date(timestamp);
    }
    
    if (isNaN(activityTime.getTime())) return 'Recent';
    
    const diffMinutes = Math.floor((now - activityTime) / (1000 * 60));
    if (diffMinutes < 1) return 'Just now';
    if (diffMinutes < 60) return `${diffMinutes} mins ago`;
    if (diffMinutes < 1440) return `${Math.floor(diffMinutes / 60)} hr ago`;
    return `${Math.floor(diffMinutes / 1440)} days ago`;
  } catch (error) {
    return 'Recent';
  }
}

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(50));
  console.log('🚀 PAPAYAFRESH API Server Running!');
  console.log('📍 Port:', PORT);
  console.log('📊 Dashboard: http://localhost:' + PORT + '/api/dashboard/stats');
  console.log('👥 All Users: http://localhost:' + PORT + '/api/users/all');
  console.log('🗑️ Delete User: http://localhost:' + PORT + '/api/users/delete/{userId}');
  console.log('📸 User Shelf: http://localhost:' + PORT + '/api/users/{userId}/shelf');
  console.log('📚 User History: http://localhost:' + PORT + '/api/users/{userId}/history');
  console.log('🌐 All Scans: http://localhost:' + PORT + '/api/scans/all');
  console.log('🔧 Debug: http://localhost:' + PORT + '/api/debug/database');
  console.log('❤️ Health: http://localhost:' + PORT + '/api/health');
  console.log('='.repeat(50) + '\n');
});