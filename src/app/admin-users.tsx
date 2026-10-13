import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

const API_URL = 'https://abu-ride.onrender.com';

export default function AdminUsersScreen() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Selected User Modal for viewing transactions
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [userTransactions, setUserTransactions] = useState<any[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error('Fetch users error:', err);
    } finally {
      setLoading(false);
    }
  };

  const inspectUser = async (user: any) => {
    setSelectedUser(user);
    setLoadingTx(true);
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const res = await fetch(`${API_URL}/api/admin/users/${user.id}/transactions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setUserTransactions(data.transactions || []);
      }
    } catch (err) {
      console.error('Fetch user tx error:', err);
    } finally {
      setLoadingTx(false);
    }
  };

  const deleteUser = (userId: number, email: string) => {
    Alert.alert(
      'Delete User ⚠️',
      `Are you sure you want to delete ${email}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await SecureStore.getItemAsync('auth_token');
              const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (data.success) {
                Alert.alert('User Deleted', 'User has been removed.');
                fetchUsers();
                setSelectedUser(null);
              } else {
                Alert.alert('Error', data.message || 'Failed to delete user');
              }
            } catch (err) {
              Alert.alert('Error', 'Connection error while deleting user.');
            }
          },
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Manage Users</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#168447" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <View style={styles.userCard}>
              <View style={styles.userInfo}>
                <Text style={styles.userName}>{item.full_name || item.email}</Text>
                <Text style={styles.userSub}>{item.email} • Role: {item.role}</Text>
                <Text style={styles.userSub}>Phone: {item.phone || 'N/A'}</Text>
              </View>

              <View style={styles.userActions}>
                <TouchableOpacity
                  style={styles.viewBtn}
                  onPress={() => inspectUser(item)}
                >
                  <Text style={styles.viewBtnText}>View Tx</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.deleteBtn}
                  onPress={() => deleteUser(item.id, item.email)}
                >
                  <Text style={styles.deleteBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {/* USER TRANSACTIONS MODAL */}
      <Modal visible={!!selectedUser} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>User Details & Transactions</Text>
            {selectedUser && (
              <Text style={styles.modalSub}>{selectedUser.full_name} ({selectedUser.email})</Text>
            )}

            {loadingTx ? (
              <ActivityIndicator color="#168447" style={{ marginVertical: 20 }} />
            ) : userTransactions.length === 0 ? (
              <Text style={styles.emptyTxText}>No recorded transactions for this user.</Text>
            ) : (
              <FlatList
                data={userTransactions}
                keyExtractor={(item) => item.id.toString()}
                style={{ maxHeight: 250, marginVertical: 12 }}
                renderItem={({ item }) => (
                  <View style={styles.txRow}>
                    <Text style={styles.txType}>{item.type || 'Transaction'}</Text>
                    <Text style={styles.txAmount}>₦{item.amount}</Text>
                  </View>
                )}
              />
            )}

            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => setSelectedUser(null)}
            >
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F7', paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15 },
  backButton: { marginRight: 15 },
  backText: { color: '#168447', fontSize: 18, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '900', color: '#17201B' },
  userCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DCE8DF',
  },
  userInfo: { marginBottom: 10 },
  userName: { fontSize: 16, fontWeight: '800', color: '#17201B' },
  userSub: { fontSize: 13, color: '#758078', marginTop: 2 },
  userActions: { flexDirection: 'row', gap: 10 },
  viewBtn: { flex: 1, backgroundColor: '#E5F4EA', padding: 10, borderRadius: 10, alignItems: 'center' },
  viewBtnText: { color: '#168447', fontWeight: '700' },
  deleteBtn: { backgroundColor: '#FFEBEB', padding: 10, borderRadius: 10, alignItems: 'center', paddingHorizontal: 15 },
  deleteBtnText: { color: '#D9534F', fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 35 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#17201B' },
  modalSub: { fontSize: 13, color: '#758078', marginTop: 4 },
  emptyTxText: { fontSize: 13, color: '#758078', marginVertical: 20, textAlign: 'center' },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#EEE' },
  txType: { fontSize: 14, color: '#17201B' },
  txAmount: { fontSize: 14, fontWeight: '700', color: '#168447' },
  closeBtn: { backgroundColor: '#EDF2EF', padding: 12, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  closeBtnText: { color: '#17201B', fontWeight: '700' },
});