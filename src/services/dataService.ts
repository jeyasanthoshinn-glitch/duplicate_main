import { db } from '../firebase/config';
import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';

export class DataService {
  private static cache: Map<string, { data: any; timestamp: number }> = new Map();
  private static CACHE_DURATION = 30000; // 30 seconds

  private static getCacheKey(collectionName: string, queryParams?: any): string {
    return `${collectionName}_${JSON.stringify(queryParams || {})}`;
  }

  private static isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  private static getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data as T;
    }
    return null;
  }

  private static setCache(key: string, data: any): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static async getRoomsWithBookings() {
    const cacheKey = this.getCacheKey('rooms_with_bookings');
    const cached = this.getFromCache<any>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const [roomsSnapshot, checkinsSnapshot] = await Promise.all([
        getDocs(collection(db, 'rooms')),
        getDocs(query(collection(db, 'checkins'), where('isCheckedOut', '==', false)))
      ]);

      const rooms = roomsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const bookings = checkinsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      const roomMap = new Map(rooms.map(r => [r.id, r]));
      const bookingMap = new Map(bookings.map(b => [b.roomId, b]));

      const result = {
        rooms,
        bookings: bookings.map(b => ({
          ...b,
          roomNumber: roomMap.get(b.roomId)?.roomNumber
        })),
        roomMap,
        bookingMap
      };

      this.setCache(cacheKey, result);
      return result;
    } catch (error) {
      console.error('Error fetching rooms with bookings:', error);
      throw error;
    }
  }

  static async getPaymentsForBookings(bookingIds: string[]) {
    if (bookingIds.length === 0) return [];

    try {
      const batchSize = 10;
      const batches: string[][] = [];

      for (let i = 0; i < bookingIds.length; i += batchSize) {
        batches.push(bookingIds.slice(i, i + batchSize));
      }

      const results = await Promise.all(
        batches.flatMap(batch =>
          batch.map(bookingId =>
            getDocs(collection(db, 'checkins', bookingId, 'payments'))
          )
        )
      );

      return results.map((snapshot, index) => ({
        bookingId: bookingIds[Math.floor(index / batchSize) * batchSize + (index % batchSize)],
        payments: snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      }));
    } catch (error) {
      console.error('Error fetching payments for bookings:', error);
      throw error;
    }
  }

  static async getPurchasesForBookings(bookingIds: string[]) {
    if (bookingIds.length === 0) return [];

    try {
      const batchSize = 10;
      const batches: string[][] = [];

      for (let i = 0; i < bookingIds.length; i += batchSize) {
        batches.push(bookingIds.slice(i, i + batchSize));
      }

      const results = await Promise.all(
        batches.flatMap(batch =>
          batch.map(bookingId =>
            getDocs(query(collection(db, 'purchases'), where('checkinId', '==', bookingId)))
          )
        )
      );

      return results.map((snapshot, index) => ({
        bookingId: bookingIds[Math.floor(index / batchSize) * batchSize + (index % batchSize)],
        purchases: snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
      }));
    } catch (error) {
      console.error('Error fetching purchases for bookings:', error);
      throw error;
    }
  }

  static async getAllPayments() {
    const cacheKey = this.getCacheKey('all_payments');
    const cached = this.getFromCache<any[]>(cacheKey);

    if (cached) {
      return cached;
    }

    try {
      const [checkinsSnapshot, directPaymentsSnapshot] = await Promise.all([
        getDocs(collection(db, 'checkins')),
        getDocs(collection(db, 'payments'))
      ]);

      const paymentPromises = checkinsSnapshot.docs.map(checkinDoc =>
        getDocs(collection(db, 'checkins', checkinDoc.id, 'payments'))
      );

      const paymentsSnapshots = await Promise.all(paymentPromises);

      const paymentRecords: any[] = [];

      checkinsSnapshot.docs.forEach((checkinDoc, index) => {
        const checkinData = checkinDoc.data();
        const paymentsSnapshot = paymentsSnapshots[index];

        const payments = paymentsSnapshot.docs.map((payDoc) => {
          const payData = payDoc.data();
          return {
            id: payDoc.id,
            amount: payData.amount,
            timestamp: payData.timestamp?.toDate() || new Date(),
            type: payData.type || 'additional',
            paymentStatus: 'completed',
            customerName: checkinData.guestName || 'Guest',
            roomNumber: checkinData.roomNumber || 'N/A',
            description: `${payData.type === 'extension' ? 'Stay extension' : payData.type === 'initial' ? 'Initial payment' : 'Additional payment'}`,
            paymentMode: payData.mode,
            mode: payData.mode
          };
        });

        paymentRecords.push(...payments);
      });

      const directPayments = directPaymentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          amount: data.amount || 0,
          timestamp: data.timestamp?.toDate() || new Date(),
          type: data.type || 'payment',
          paymentStatus: data.paymentStatus || 'completed',
          customerName: data.customerName || data.customer_name || 'Guest',
          roomNumber: data.roomNumber || 'N/A',
          description: data.description || data.note || 'Payment',
          paymentMode: data.paymentMode || data.mode,
          mode: data.mode || data.paymentMode
        };
      });

      paymentRecords.push(...directPayments);

      this.setCache(cacheKey, paymentRecords);
      return paymentRecords;
    } catch (error) {
      console.error('Error fetching all payments:', error);
      throw error;
    }
  }

  static async getCollectionLogs() {
    try {
      const logsQuery = query(
        collection(db, 'collection_logs'),
        orderBy('collectedAt', 'desc'),
        limit(50)
      );

      const logsSnapshot = await getDocs(logsQuery);
      return logsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching collection logs:', error);
      throw error;
    }
  }
}
