import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Pencil, Trash, LogIn, UserCheck, Loader, BadgeDollarSign, BedDouble } from 'lucide-react';
import { toast } from 'react-toastify';
import { motion, AnimatePresence } from 'framer-motion';

type Room = {
  id: string;
  roomNumber: number;
  floor: string;
  type: string;
  status: 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'extension';
  hasPendingPayment?: boolean;
};

type ConfirmModal = {
  show: boolean;
  roomId: string | null;
  action: 'delete' | 'status' | 'payment' | null;
  newStatus?: string;
  newPaymentStatus?: boolean;
};

const RoomList = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({
    show: false,
    roomId: null,
    action: null
  });
  const [filter, setFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      const roomsCollection = collection(db, 'rooms');
      const roomSnapshot = await getDocs(roomsCollection);
      const roomList = roomSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];

      roomList.sort((a, b) => a.roomNumber - b.roomNumber);
      setRooms(roomList);
      setLoading(false);
    } catch (error) {
      toast.error('Failed to fetch rooms');
      setLoading(false);
    }
  };

  const handleStatusChange = async () => {
    if (!confirmModal.roomId || !confirmModal.newStatus) return;
    try {
      const roomRef = doc(db, 'rooms', confirmModal.roomId);
      await updateDoc(roomRef, {
        status: confirmModal.newStatus
      });

      setRooms(rooms.map(room =>
        room.id === confirmModal.roomId ? { ...room, status: confirmModal.newStatus! } : room
      ));

      toast.success(`Room status updated to ${confirmModal.newStatus}`);
      setConfirmModal({ show: false, roomId: null, action: null });
    } catch (error) {
      toast.error('Failed to update room status');
    }
  };

  const handlePaymentStatusChange = async () => {
    if (!confirmModal.roomId || confirmModal.newPaymentStatus === undefined) return;
    try {
      const roomRef = doc(db, 'rooms', confirmModal.roomId);
      await updateDoc(roomRef, {
        hasPendingPayment: confirmModal.newPaymentStatus
      });

      setRooms(rooms.map(room =>
        room.id === confirmModal.roomId ? { ...room, hasPendingPayment: confirmModal.newPaymentStatus } : room
      ));

      toast.success(`Payment status updated to ${confirmModal.newPaymentStatus ? 'Pending' : 'Cleared'}`);
      setConfirmModal({ show: false, roomId: null, action: null });
    } catch (error) {
      toast.error('Failed to update payment status');
    }
  };

  const handleDeleteRoom = async () => {
    if (!confirmModal.roomId) return;
    try {
      await deleteDoc(doc(db, 'rooms', confirmModal.roomId));
      setRooms(rooms.filter(room => room.id !== confirmModal.roomId));
      toast.success('Room deleted successfully');
      setConfirmModal({ show: false, roomId: null, action: null });
    } catch (error) {
      toast.error('Failed to delete room');
    }
  };

  const getCardColor = (status: Room['status']) => {
    switch (status) {
      case 'available':
        return 'bg-green-100 border-green-500';
      case 'occupied':
        return 'bg-red-100 border-red-500';
      case 'cleaning':
        return 'bg-yellow-100 border-yellow-500';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const filteredRooms = filter === 'all' ? rooms : rooms.filter(room => room.status === filter);

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Room Management</h1>
        <button
          onClick={() => navigate('/rooms/add')}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
        >
          <Plus className="h-5 w-5 mr-1" /> Add Room
        </button>
      </div>

      <div className="mb-6">
        <div className="flex flex-wrap gap-2">
          {['all', 'available', 'occupied', 'cleaning'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                filter === status
                  ? `bg-${status === 'available' ? 'green' : status === 'occupied' ? 'red' : 'yellow'}-600 text-white`
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status === 'all' ? 'All Rooms' : `${status.charAt(0).toUpperCase()}${status.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <AnimatePresence>
            {filteredRooms.map((room) => (
              <motion.div
                key={room.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`rounded-lg border shadow-md overflow-hidden ${getCardColor(room.status)}`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">
                      Room {room.roomNumber}
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/rooms/edit/${room.id}`)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                      >
                        <Pencil className="h-4 w-4 inline mr-1" />
                      </button>
                      {room.status !== 'occupied' && (
                        <button
                          onClick={() => setConfirmModal({ show: true, roomId: room.id, action: 'delete' })}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                        >
                          <Trash className="h-4 w-4 inline mr-1" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Floor {room.floor} • {room.type.toUpperCase()}
                  </p>
                </div>

              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">
              {confirmModal.action === 'delete'
                ? 'Delete Room'
                : confirmModal.action === 'payment'
                ? 'Update Payment Status'
                : 'Change Room Status'}
            </h2>
            <p className="mb-6">
              {confirmModal.action === 'delete'
                ? 'Are you sure you want to delete this room? This action cannot be undone.'
                : confirmModal.action === 'payment'
                ? `Mark payment as ${confirmModal.newPaymentStatus ? 'Pending' : 'Cleared'}?`
                : `Change room status to ${confirmModal.newStatus}?`}
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmModal({ show: false, roomId: null, action: null })}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={
                  confirmModal.action === 'delete'
                    ? handleDeleteRoom
                    : confirmModal.action === 'payment'
                    ? handlePaymentStatusChange
                    : handleStatusChange
                }
                className={`px-4 py-2 text-sm text-white rounded-md ${
                  confirmModal.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomList;
