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
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

const API_URL = 'https://abu-ride.onrender.com';

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Reply Modal
  const [replyModalVisible, setReplyModalVisible] = useState(false);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const res = await fetch(`${API_URL}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
      }
    } catch (err) {
      console.error('Fetch reports error:', err);
    } finally {
      setLoading(false);
    }
  };

  const openReplyModal = (report: any) => {
    setSelectedReport(report);
    setReplyMessage('');
    setReplyModalVisible(true);
  };

  const sendReply = async () => {
    if (!replyMessage.trim()) {
      Alert.alert('Error', 'Please enter a reply message.');
      return;
    }

    try {
      setSendingReply(true);
      const token = await SecureStore.getItemAsync('auth_token');
      const res = await fetch(`${API_URL}/api/admin/reports/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          report_id: selectedReport.id,
          user_id: selectedReport.reporter_id,
          message: replyMessage.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Reply Sent 📩', 'Response sent directly to user notification hub.');
        setReplyModalVisible(false);
        fetchReports();
      } else {
        Alert.alert('Error', data.message || 'Failed to send reply.');
      }
    } catch (err) {
      Alert.alert('Error', 'Connection error while sending reply.');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Reports & Complaints</Text>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#168447" style={{ marginTop: 40 }} />
      ) : reports.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>No complaints reported yet!</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.issueType}>{item.issue_type || 'General Issue'}</Text>
                <Text style={styles.roleTag}>{item.role || 'user'}</Text>
              </View>

              <Text style={styles.description}>{item.description}</Text>
              <Text style={styles.dateText}>
                Logged at: {new Date(item.created_at).toLocaleString()}
              </Text>

              <TouchableOpacity
                style={styles.replyBtn}
                onPress={() => openReplyModal(item)}
              >
                <Text style={styles.replyBtnText}>Reply to User 📩</Text>
              </TouchableOpacity>
            </View>
          )}
        />
      )}

      {/* REPLY MODAL */}
      <Modal visible={replyModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Send Reply to User</Text>
            <Text style={styles.modalSub}>
              Issue: {selectedReport?.issue_type}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Type your response here..."
              value={replyMessage}
              onChangeText={setReplyMessage}
              multiline
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setReplyModalVisible(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.submitBtn}
                onPress={sendReply}
                disabled={sendingReply}
              >
                <Text style={styles.submitBtnText}>
                  {sendingReply ? 'Sending...' : 'Send Reply'}
                </Text>
              </TouchableOpacity>
            </View>
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
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#758078' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DCE8DF',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  issueType: { fontSize: 15, fontWeight: '800', color: '#D9534F' },
  roleTag: { fontSize: 11, color: '#168447', backgroundColor: '#E5F4EA', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, fontWeight: '700' },
  description: { fontSize: 13, color: '#17201B', marginTop: 8, lineHeight: 18 },
  dateText: { fontSize: 11, color: '#758078', marginTop: 10 },
  replyBtn: { backgroundColor: '#168447', padding: 10, borderRadius: 10, alignItems: 'center', marginTop: 12 },
  replyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 35 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#17201B' },
  modalSub: { fontSize: 13, color: '#758078', marginTop: 4, marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#DCE8DF', borderRadius: 12, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 15 },
  modalButtons: { flexDirection: 'row', gap: 10 },
  cancelBtn: { flex: 1, backgroundColor: '#EDF2EF', padding: 12, borderRadius: 12, alignItems: 'center' },
  cancelBtnText: { color: '#17201B', fontWeight: '700' },
  submitBtn: { flex: 1, backgroundColor: '#168447', padding: 12, borderRadius: 12, alignItems: 'center' },
  submitBtnText: { color: '#FFFFFF', fontWeight: '700' },
});