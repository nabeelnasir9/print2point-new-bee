const NotificationToken = require("../models/notification-token-schema.js");

/**
 * Send push notification to a user
 */
const sendPushNotification = async (userId, userType, notificationData) => {
  try {
    // Get all active tokens for the user
    const tokens = await NotificationToken.find({ 
      user_id: userId, 
      user_type: userType, 
      is_active: true 
    });

    if (tokens.length === 0) {
      console.log(`No active notification tokens found for user: ${userId}`);
      return;
    }

    // Prepare notifications for all user's devices
    const notifications = tokens.map(token => ({
      to: token.device_token,
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {},
      sound: 'default',
      badge: 1
    }));

    // Send notifications via Expo Push API
    const chunks = chunkArray(notifications, 100); // Expo allows max 100 notifications per request
    
    for (const chunk of chunks) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk)
        });

        const result = await response.json();
        
        if (response.ok) {
          console.log(`Push notifications sent successfully: ${chunk.length} notifications`);
          
          // Check for invalid tokens and mark them as inactive
          if (result.data) {
            for (let i = 0; i < result.data.length; i++) {
              const pushResult = result.data[i];
              if (pushResult.status === 'error' && 
                  (pushResult.details?.error === 'DeviceNotRegistered' || 
                   pushResult.details?.error === 'InvalidCredentials')) {
                // Mark token as inactive
                const tokenToDisable = tokens[i];
                if (tokenToDisable) {
                  await NotificationToken.findByIdAndUpdate(tokenToDisable._id, { is_active: false });
                  console.log(`Disabled invalid notification token: ${tokenToDisable.device_token}`);
                }
              }
            }
          }
        } else {
          console.error('Expo push notification error:', result);
        }
      } catch (chunkError) {
        console.error('Error sending notification chunk:', chunkError);
      }
    }

  } catch (error) {
    console.error('Push notification error:', error);
  }
};

/**
 * Register a device token for push notifications
 */
const registerNotificationToken = async (userId, userType, deviceToken, platform = 'mobile') => {
  try {
    // Check if token already exists
    const existingToken = await NotificationToken.findOne({ device_token: deviceToken });
    
    if (existingToken) {
      // Update existing token
      existingToken.user_id = userId;
      existingToken.user_type = userType;
      existingToken.platform = platform;
      existingToken.is_active = true;
      existingToken.updated_at = new Date();
      await existingToken.save();
      
      console.log(`Updated existing notification token for user: ${userId}`);
      return existingToken;
    } else {
      // Create new token
      const newToken = new NotificationToken({
        user_id: userId,
        user_type: userType,
        device_token: deviceToken,
        platform: platform,
        is_active: true
      });
      
      await newToken.save();
      console.log(`Registered new notification token for user: ${userId}`);
      return newToken;
    }

  } catch (error) {
    console.error('Error registering notification token:', error);
    throw error;
  }
};

/**
 * Unregister a device token
 */
const unregisterNotificationToken = async (deviceToken) => {
  try {
    const result = await NotificationToken.findOneAndUpdate(
      { device_token: deviceToken },
      { is_active: false },
      { new: true }
    );
    
    if (result) {
      console.log(`Unregistered notification token: ${deviceToken}`);
    }
    
    return result;

  } catch (error) {
    console.error('Error unregistering notification token:', error);
    throw error;
  }
};

/**
 * Send bulk notifications (for system announcements, etc.)
 */
const sendBulkNotification = async (userType, notificationData, userIds = null) => {
  try {
    let query = { user_type: userType, is_active: true };
    
    if (userIds && userIds.length > 0) {
      query.user_id = { $in: userIds };
    }
    
    const tokens = await NotificationToken.find(query);
    
    if (tokens.length === 0) {
      console.log(`No active tokens found for bulk notification to ${userType}`);
      return;
    }
    
    const notifications = tokens.map(token => ({
      to: token.device_token,
      title: notificationData.title,
      body: notificationData.body,
      data: notificationData.data || {},
      sound: 'default'
    }));
    
    // Send in chunks
    const chunks = chunkArray(notifications, 100);
    let totalSent = 0;
    
    for (const chunk of chunks) {
      try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip, deflate',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(chunk)
        });
        
        if (response.ok) {
          totalSent += chunk.length;
        }
        
      } catch (chunkError) {
        console.error('Error sending bulk notification chunk:', chunkError);
      }
    }
    
    console.log(`Bulk notification sent to ${totalSent} devices`);
    return totalSent;

  } catch (error) {
    console.error('Bulk notification error:', error);
    throw error;
  }
};

/**
 * Helper function to chunk array into smaller arrays
 */
const chunkArray = (array, chunkSize) => {
  const chunks = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
};

module.exports = {
  sendPushNotification,
  registerNotificationToken,
  unregisterNotificationToken,
  sendBulkNotification
};