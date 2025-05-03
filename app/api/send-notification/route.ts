// app/api/send-notification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import admin from 'firebase-admin';
// Initialize Firebase Admin SDK only once
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

export async function POST(req: NextRequest) {
    try {
      const body = await req.json();
      const { token, notification } = body;
        
      // Construct the message payload
      const message = {
        token,
        notification: {
          title: notification.title,
          body: notification.body,
        },
        data: {
          icon: notification.icon || '', // Move icon to data field
        },
      };
  
      // Send the notification using Firebase Admin SDK
      const response = await admin.messaging().send(message);
      return NextResponse.json({ success: true, message: response });
    } catch (error) {
      console.error('Error sending notification:', error);
      return NextResponse.json(
        { success: false, error: (error as Error).message },
        { status: 500 }
      );
    }
  }
