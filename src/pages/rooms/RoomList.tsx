import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../firebase/config';
import { collection, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Plus, Pencil, Trash, AlertCircle, BedDouble } from 'lucide-react';
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
  const [error, setError] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModal>({
    show: false,
    roomId: null,
    action: null
  });
  const [filter, setFilter] = useState<string>('all');
  const navigate = useNavigate();

  useEffect(() => {
    let isMounted = true;

    const loadRooms = async () => {
      try {
        await fetchRooms(isMounted);
      } catch (err) {
        if (isMounted) {
          console.error('Error in loadRooms:', err);
          setError('Failed to load rooms');
          setLoading(false);
        }
      }
    };

    loadRooms();

    return () => {
      isMounted = false;
    };
  }, []);

  const fetchRooms = async (isMounted = true) => {
    try {
      setError(null);

      if (!db) {
        throw new Error('Database connection not available');
      }

      const roomsCollection = collection(db, 'rooms');
      const roomSnapshot = await getDocs(roomsCollection);

      if (!isMounted) return;

      const roomList = roomSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          roomNumber: data.roomNumber ?? 0,
          floor: data.floor ?? '1',
          type: data.type ?? 'standard',
          status: data.status ?? 'available',
          hasPendingPayment: data.hasPendingPayment ?? false
        } as Room;
      });

      roomList.sort((a, b) => (a.roomNumber || 0) - (b.roomNumber || 0));

      setRooms(roomList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching rooms:', error);

      if (isMounted) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to fetch rooms';
        setError(errorMessage);
        toast.error(errorMessage);
        setLoading(false);
      }
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
        room.id === confirmModal.roomId ? { ...room, status: confirmModal.newStatus as Room['status'] } : room
      ));

      toast.success(`Room status updated to ${confirmModal.newStatus}`);
      setConfirmModal({ show: false, roomId: null, action: null });
    } catch (error) {
      console.error('Error updating room status:', error);
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
      console.error('Error updating payment status:', error);
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
      console.error('Error deleting room:', error);
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
      case 'maintenance':
        return 'bg-orange-100 border-orange-500';
      case 'extension':
        return 'bg-purple-100 border-purple-500';
      default:
        return 'bg-gray-100 border-gray-300';
    }
  };

  const filteredRooms = filter === 'all' ? rooms : rooms.filter(room => room.status === filter);

  // Error State UI
  if (error && !loading) {
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

        <div className="bg-red-50 border border-red-200 rounded-lg p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <h3 className="text-lg font-semibold text-red-900 mb-2">Error Loading Rooms</h3>
          <p className="text-red-700 mb-4">{error}</p>
          <button
            onClick={() => {
              setLoading(true);
              fetchRooms();
            }}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

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
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                filter === status
                  ? status === 'all'
                    ? 'bg-blue-600 text-white'
                    : status === 'available'
                    ? 'bg-green-600 text-white'
                    : status === 'occupied'
                    ? 'bg-red-600 text-white'
                    : 'bg-yellow-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {status === 'all' ? 'All Rooms' : `${status.charAt(0).toUpperCase()}${status.slice(1)}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
          <p className="text-gray-600">Loading rooms...</p>
        </div>
      ) : rooms.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <BedDouble className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No Rooms Available</h3>
          <p className="text-gray-500 mb-6">Get started by adding your first room.</p>
          <button
            onClick={() => navigate('/rooms/add')}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Room
          </button>
        </div>
      ) : filteredRooms.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <BedDouble className="h-16 w-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">No Rooms Found</h3>
          <p className="text-gray-500 mb-4">
            No rooms match the filter: <strong>{filter}</strong>
          </p>
          <button
            onClick={() => setFilter('all')}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
          >
            Show All Rooms
          </button>
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
                className={`rounded-lg border-2 shadow-md overflow-hidden ${getCardColor(room.status)}`}
              >
                <div className="p-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-900">
                      Room {room.roomNumber}
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => navigate(`/rooms/edit/${room.id}`)}
                        className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors duration-200"
                        title="Edit room"
                      >
                        <Pencil className="h-4 w-4 inline mr-1" />
                      </button>
                      {room.status !== 'occupied' && (
                        <button
                          onClick={() => setConfirmModal({ show: true, roomId: room.id, action: 'delete' })}
                          className="px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors duration-200"
                          title="Delete room"
                        >
                          <Trash className="h-4 w-4 inline mr-1" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-2">
                    Floor {room.floor} • {room.type ? room.type.toUpperCase() : 'STANDARD'}
                  </p>
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 text-xs font-semibold rounded ${
                      room.status === 'available' ? 'bg-green-200 text-green-800' :
                      room.status === 'occupied' ? 'bg-red-200 text-red-800' :
                      room.status === 'cleaning' ? 'bg-yellow-200 text-yellow-800' :
                      'bg-gray-200 text-gray-800'
                    }`}>
                      {room.status ? room.status.toUpperCase() : 'UNKNOWN'}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {confirmModal.show && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white p-6 rounded-lg shadow-xl max-w-md w-full"
          >
            <h2 className="text-xl font-bold mb-4">
              {confirmModal.action === 'delete'
                ? 'Delete Room'
                : confirmModal.action === 'payment'
                ? 'Update Payment Status'
                : 'Change Room Status'}
            </h2>
            <p className="mb-6 text-gray-700">
              {confirmModal.action === 'delete'
                ? 'Are you sure you want to delete this room? This action cannot be undone.'
                : confirmModal.action === 'payment'
                ? `Mark payment as ${confirmModal.newPaymentStatus ? 'Pending' : 'Cleared'}?`
                : `Change room status to ${confirmModal.newStatus}?`}
            </p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setConfirmModal({ show: false, roomId: null, action: null })}
                className="px-4 py-2 border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
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
                className={`px-4 py-2 text-sm text-white rounded-md transition-colors duration-200 ${
                  confirmModal.action === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                Confirm
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default RoomList;
