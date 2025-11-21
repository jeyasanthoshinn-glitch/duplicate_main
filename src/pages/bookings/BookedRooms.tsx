import React, { useEffect, useState, useMemo } from 'react';
import { collection, getDocs, doc, getDoc, query, where, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { format } from 'date-fns';
import { Loader, Phone, UserIcon, CreditCard } from 'lucide-react';
import { toast } from 'react-toastify';
import { ShopPurchaseService } from '../shop/ShopPurchaseService';
import { motion } from 'framer-motion';

type Room = {
  id: string;
  roomNumber: number;
  floor: string;
};

type Customer = {
  id: string;
  guestName: string;
  phoneNumber: string;
  checkedInAt: Timestamp;
  checkedOutAt: Timestamp;
  rent: number;
  isCheckedOut: boolean;
  roomId: string;
};

type PaymentEntry = {
  id: string;
  amount: number;
  mode: string;
  type: string;
  timestamp: any;
  description?: string;
};

type ShopPurchase = {
  id: string;
  inventoryId: string;
  itemName: string;
  quantity: number;
  amount: number;
  createdAt: any;
  paymentStatus: string;
};

const BookedRooms: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFloor, setSelectedFloor] = useState<string>('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [paymentHistory, setPaymentHistory] = useState<PaymentEntry[]>([]);
  const [shopPurchases, setShopPurchases] = useState<ShopPurchase[]>([]);
  const [activeTab, setActiveTab] = useState<'payments' | 'purchases'>('payments');

  useEffect(() => {
    fetchRooms();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      fetchCustomers(selectedRoomId);
    }
  }, [selectedRoomId]);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const roomsCollection = collection(db, 'rooms');
      const roomsSnapshot = await getDocs(roomsCollection);

      const roomsList: Room[] = [];
      roomsSnapshot.forEach((doc) => {
        const data = doc.data();
        roomsList.push({
          id: doc.id,
          roomNumber: data.roomNumber || 0,
          floor: data.floor || '1'
        });
      });

      roomsList.sort((a, b) => {
        const floorDiff = parseInt(a.floor) - parseInt(b.floor);
        if (floorDiff !== 0) return floorDiff;
        return a.roomNumber - b.roomNumber;
      });

      setRooms(roomsList);

      // Set default floor to first available
      if (roomsList.length > 0) {
        const firstFloor = roomsList[0].floor;
        setSelectedFloor(firstFloor);
      }
    } catch (error) {
      console.error('Error fetching rooms:', error);
      toast.error('Failed to fetch rooms');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async (roomId: string) => {
    try {
      const checkinsRef = collection(db, 'checkins');
      const q = query(checkinsRef, where('roomId', '==', roomId), where('isCheckedOut', '==', true));
      const querySnapshot = await getDocs(q);

      const customersData: Customer[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        customersData.push({
          id: doc.id,
          guestName: data.guestName || 'Unknown Guest',
          phoneNumber: data.phoneNumber || 'N/A',
          checkedInAt: data.checkedInAt,
          checkedOutAt: data.checkedOutAt,
          rent: data.rent || 0,
          isCheckedOut: data.isCheckedOut || false,
          roomId: data.roomId
        });
      });

      customersData.sort((a, b) => b.checkedInAt.seconds - a.checkedInAt.seconds);
      setCustomers(customersData);
      setSelectedCustomer(null);
      setPaymentHistory([]);
      setShopPurchases([]);
    } catch (error) {
      console.error('Error fetching customers:', error);
      toast.error('Failed to fetch customer details');
    }
  };

  const fetchPaymentHistory = async (customer: Customer) => {
    try {
      const paymentRef = collection(db, 'checkins', customer.id, 'payments');
      const q = query(paymentRef, orderBy('timestamp', 'asc'));
      const snapshot = await getDocs(q);
      const history = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as PaymentEntry[];

      const rentEntry: PaymentEntry = {
        id: 'rent-entry',
        amount: customer.rent,
        mode: 'n/a',
        type: 'Rent (Check-in)',
        timestamp: customer.checkedInAt || Timestamp.now(),
      };

      const shopPurchasesData = await ShopPurchaseService.getPurchasesByCheckin(customer.id);
      setShopPurchases(shopPurchasesData as ShopPurchase[]);

      const initialPayment = history.find(p => p.type === 'initial');

      const advanceEntry = initialPayment || {
        id: 'advance-entry',
        amount: customer.rent,
        mode: 'cash',
        type: 'initial',
        timestamp: customer.checkedInAt || Timestamp.now(),
        description: 'Initial payment at check-in'
      };

      const fullHistory = [rentEntry, advanceEntry, ...history.filter(p => p.type !== 'initial')];
      setPaymentHistory(fullHistory);
      setSelectedCustomer(customer);
    } catch (error) {
      console.error('Error fetching payment history:', error);
      toast.error('Failed to fetch payment history');
    }
  };

  const uniqueFloors = useMemo(() => {
    const floors = [...new Set(rooms.map(r => r.floor))];
    return floors.sort((a, b) => parseInt(a) - parseInt(b));
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter(r => r.floor === selectedFloor);
  }, [rooms, selectedFloor]);

  const formatDate = (timestamp: Timestamp) => {
    if (!timestamp || !timestamp.toDate) return '—';
    return format(timestamp.toDate(), 'dd MMM yyyy h:mm a');
  };

  const getTotalShopPurchases = useMemo(() => {
    return shopPurchases.reduce((total, purchase) => total + purchase.amount, 0);
  }, [shopPurchases]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader className="h-8 w-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h1 className="text-3xl font-bold text-gray-800 mb-8">Customer History</h1>

      {/* Selection Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Select Room</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Floor Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Floor
            </label>
            <select
              value={selectedFloor}
              onChange={(e) => {
                setSelectedFloor(e.target.value);
                setSelectedRoomId('');
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a floor</option>
              {uniqueFloors.map((floor) => (
                <option key={floor} value={floor}>
                  Floor {floor}
                </option>
              ))}
            </select>
          </div>

          {/* Room Dropdown */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Room Number
            </label>
            <select
              value={selectedRoomId}
              onChange={(e) => setSelectedRoomId(e.target.value)}
              disabled={!selectedFloor}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">Choose a room</option>
              {filteredRooms.map((room) => (
                <option key={room.id} value={room.id}>
                  Room {room.roomNumber}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Customer History */}
      {selectedRoomId && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">
                Customer History
              </h3>

              {customers.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No customer history</p>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {customers.map((customer) => (
                    <motion.button
                      key={customer.id}
                      onClick={() => fetchPaymentHistory(customer)}
                      whileHover={{ scale: 1.02 }}
                      className={`w-full p-3 text-left rounded-lg border-2 transition-colors ${
                        selectedCustomer?.id === customer.id
                          ? 'bg-blue-50 border-blue-500'
                          : 'bg-white border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <div className="font-medium text-gray-900">{customer.guestName}</div>
                      <div className="text-xs text-gray-500 mt-1 flex items-center">
                        <Phone className="h-3 w-3 mr-1" />
                        {customer.phoneNumber}
                      </div>
                      <div className="text-xs text-gray-400 mt-1">
                        {formatDate(customer.checkedInAt).split(' ').slice(0, 2).join(' ')}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Transaction Details */}
          {selectedCustomer && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="lg:col-span-2"
            >
              <div className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-700 mb-4">
                  {selectedCustomer.guestName} - Transaction History
                </h3>

                {/* Customer Info Summary */}
                <div className="bg-gray-50 p-4 rounded-lg mb-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Check-in:</span>
                    <span className="font-medium">{formatDate(selectedCustomer.checkedInAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Check-out:</span>
                    <span className="font-medium">{formatDate(selectedCustomer.checkedOutAt)}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t">
                    <span className="text-gray-600">Total Rent:</span>
                    <span className="font-medium">₹{(() => {
                      let totalRent = selectedCustomer.rent;
                      paymentHistory.forEach(p => {
                        if (p.type === 'extension' || p.type === 'shop-purchase') {
                          totalRent += Math.abs(p.amount);
                        }
                      });
                      return totalRent.toFixed(2);
                    })()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Paid:</span>
                    <span className="font-medium">₹{(() => {
                      const cashGpayPayments = paymentHistory.filter(entry =>
                        (entry.type === 'initial' || entry.type === 'advance') &&
                        (entry.mode === 'cash' || entry.mode === 'gpay')
                      );
                      return cashGpayPayments.reduce((total, p) => total + p.amount, 0).toFixed(2);
                    })()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Pending:</span>
                    <span className="font-medium text-red-600">₹{(() => {
                      let totalRent = selectedCustomer.rent;
                      paymentHistory.forEach(p => {
                        if (p.type === 'extension' || p.type === 'shop-purchase') {
                          totalRent += Math.abs(p.amount);
                        }
                      });
                      const cashGpayPayments = paymentHistory.filter(entry =>
                        (entry.type === 'initial' || entry.type === 'advance') &&
                        (entry.mode === 'cash' || entry.mode === 'gpay')
                      );
                      const totalPaid = cashGpayPayments.reduce((total, p) => total + p.amount, 0);
                      return Math.max(0, totalRent - totalPaid).toFixed(2);
                    })()}</span>
                  </div>
                </div>

                {/* Tabs */}
                <div className="border-b border-gray-200 mb-4">
                  <nav className="-mb-px flex">
                    <button
                      onClick={() => setActiveTab('payments')}
                      className={`py-2 px-4 text-sm font-medium ${
                        activeTab === 'payments'
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Payment History
                    </button>
                    <button
                      onClick={() => setActiveTab('purchases')}
                      className={`py-2 px-4 text-sm font-medium flex items-center ${
                        activeTab === 'purchases'
                          ? 'border-b-2 border-blue-500 text-blue-600'
                          : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      Shop Purchases
                      {shopPurchases.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-800 rounded-full text-xs">
                          {shopPurchases.length}
                        </span>
                      )}
                    </button>
                  </nav>
                </div>

                {/* Payment History Table */}
                {activeTab === 'payments' && (
                  <div className="overflow-auto max-h-64 border rounded">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="p-2 text-left text-xs font-medium">Date</th>
                          <th className="p-2 text-left text-xs font-medium">Time</th>
                          <th className="p-2 text-left text-xs font-medium">Process</th>
                          <th className="p-2 text-left text-xs font-medium">Cash</th>
                          <th className="p-2 text-left text-xs font-medium">Gpay</th>
                          <th className="p-2 text-left text-xs font-medium">Rent</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paymentHistory.map((entry, i) => {
                          const dt = entry.timestamp?.toDate?.();
                          const date = dt ? new Date(dt).toLocaleDateString('en-IN') : '—';
                          const time = dt ? new Date(dt).toLocaleTimeString('en-IN', {
                            hour: '2-digit',
                            minute: '2-digit'
                          }) : '—';

                          let process = '';
                          let rentAmount = null;
                          let cashAmount = null;
                          let gpayAmount = null;

                          switch (entry.type) {
                            case 'Rent (Check-in)':
                              process = 'Check-in';
                              rentAmount = entry.amount;
                              break;
                            case 'extension':
                              process = 'Extension';
                              rentAmount = entry.amount;
                              break;
                            case 'initial':
                              process = 'Initial Payment';
                              if (entry.mode === 'cash') cashAmount = entry.amount;
                              if (entry.mode === 'gpay') gpayAmount = entry.amount;
                              break;
                            case 'advance':
                              process = 'Additional Payment';
                              if (entry.mode === 'cash') cashAmount = entry.amount;
                              if (entry.mode === 'gpay') gpayAmount = entry.amount;
                              break;
                            case 'shop-purchase':
                              process = 'Shop Purchase';
                              rentAmount = Math.abs(entry.amount);
                              break;
                            default:
                              process = entry.type || 'Transaction';
                          }

                          return (
                            <tr key={i} className="border-t hover:bg-gray-50">
                              <td className="p-2 text-xs">{date}</td>
                              <td className="p-2 text-xs">{time}</td>
                              <td className="p-2 text-xs font-medium">{process}</td>
                              <td className="p-2 text-xs text-green-600">{cashAmount ? `₹${cashAmount.toFixed(2)}` : '—'}</td>
                              <td className="p-2 text-xs text-blue-600">{gpayAmount ? `₹${gpayAmount.toFixed(2)}` : '—'}</td>
                              <td className="p-2 text-xs text-gray-700">{rentAmount ? `₹${rentAmount.toFixed(2)}` : '—'}</td>
                            </tr>
                          );
                        })}
                        {paymentHistory.length === 0 && (
                          <tr>
                            <td colSpan={6} className="p-2 text-center text-gray-500 text-xs">
                              No payment history found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Shop Purchases */}
                {activeTab === 'purchases' && (
                  <div className="overflow-x-auto">
                    {shopPurchases.length === 0 ? (
                      <p className="text-center text-gray-500 py-4">No shop purchases</p>
                    ) : (
                      <>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Date
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Item
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                                Qty
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                Amount
                              </th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {shopPurchases.map((purchase) => {
                              const dt = purchase.createdAt?.toDate?.();
                              const date = dt ? format(new Date(dt), 'dd MMM yyyy') : '—';

                              return (
                                <tr key={purchase.id} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 text-sm text-gray-900">{date}</td>
                                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                    {purchase.itemName}
                                  </td>
                                  <td className="px-4 py-3 text-sm text-center text-gray-600">
                                    {purchase.quantity}
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-right text-gray-900">
                                    ₹{purchase.amount.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-right">
                          <span className="font-medium text-gray-700">Total: </span>
                          <span className="font-bold text-lg">₹{getTotalShopPurchases.toFixed(2)}</span>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};

export default BookedRooms;
