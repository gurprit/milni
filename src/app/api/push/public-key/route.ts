import {NextResponse} from 'next/server';
import {pushConfigured,vapidPublicKey} from '../../../../lib/webPush';

export async function GET(){
 return NextResponse.json({ok:true,configured:pushConfigured(),publicKey:vapidPublicKey()});
}
