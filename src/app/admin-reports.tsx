import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const API_URL = 'https://abu-ride.onrender.com';

type Report = {
  id: number;
  title?: string;
  message: string;
  status?: string;
  created_at: string;
  reporter_id?: number | string;
  user_id?: number | string;
  users?: {
    full_name?: string;
    email?: string;
    role?: string;
  };
};

export default function AdminReportsScreen() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      setLoading(true);
      const token = await SecureStore.getItemAsync('auth_token');
      const res = await fetch(`${API_URL}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setReports(data.reports || []);
      } else {
        Alert.alert('Error', data.message || 'Could not load reports');
      }
    } catch (err) {
      console.error('Fetch reports error:', err);
      Alert.alert('Connection Error', 'Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedReport) return;
    if (!replyMessage.trim()) {
      Alert.alert('Validation', 'Please type a reply message.');
      return;
    }

    const userId = selectedReport.reporter_id || selectedReport.user_id || selectedReport.users?.full_name;

    try {
      setSending(true);
      const token = await SecureStore.getItemAsync('auth_token');
      const res = await fetch(`${API_URL}/api/admin/reports/reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          report_id: selectedReport.id,
          user_id: userId,
          message: replyMessage,
        }),
      });

      const data = await res.json();
      if (data.success) {
        Alert.alert('Success', 'Reply sent successfully to the user!');
        setSelectedReport(null);
        setReplyMessage('');
        fetchReports();
      } else {
        Alert.alert('Error', data.message || 'Could not send reply');
      }
    } catch (err) {
      console.error('Send reply error:', err);
      Alert.alert('Error', 'Connection error while sending reply.');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Issue Reports</Text>
        <Pressable onPress={fetchReports} style={styles.refreshBtn}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#168447" style={{ marginTop: 40 }} />
      ) : reports.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No Issue Reports</Text>
          <Text style={styles.emptyText}>There are no pending user reports at this time.</Text>
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ padding: 20 }}
          renderItem={({ item }) => (
            <View style={styles.reportCard}>
              <View style={styles.reportHeader}>
                <Text style={styles.reportTitle}>{item.title || 'Report #' + item.id}</Text>
                <Text style={styles.reportDate}>
                  {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
                </Text>
              </View>

              <Text style={styles.reporterName}>
                From: {item.users?.full_name || item.users?.email || 'User #' + (item.reporter_id || item.user_id)} ({item.users?.role || 'user'})
              </Text>

              <Text style={styles.reportMessage}>{item.message}</Text>

              <Pressable
                style={styles.replyBtn}
                onPress={() => setSelectedReport(item)}
              >
                <Text style={styles.replyBtnText}>Reply to User</Text>
              </Pressable>
            </View>
          )}
        />
      )}

      {/* REPLY MODAL */}
      <Modal visible={!!selectedReport} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Reply to Report</Text>
            {selectedReport && (
              <Text style={styles.modalSub}>
                Responding to {selectedReport.users?.full_name || 'User'}
              </Text>
            )}

            <TextInput
              style={styles.replyInput}
              placeholder="Write your response here..."
              multiline
              numberOfLines={4}
              value={replyMessage}
              onChangeText={setReplyMessage}
            />

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={() => {
                  setSelectedReport(null);
                  setReplyMessage('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[styles.modalBtn, styles.sendBtn]}
                onPress={handleSendReply}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.sendBtnText}>Send Reply</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F6F8F7', paddingTop: 50 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 15 },
  backBtn: { paddingVertical: 5 },
  backText: { color: '#168447', fontSize: 18, fontWeight: '800' },
  title: { fontSize: 20, fontWeight: '900', color: '#17201B' },
  refreshBtn: { paddingVertical: 5 },
  refreshText: { color: '#168447', fontWeight: '800', fontSize: 13 },
  reportCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#DCE8DF' },
  reportHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reportTitle: { fontSize: 16, fontWeight: '800', color: '#17201B' },
  reportDate: { fontSize: 11, color: '#758078' },
  reporterName: { fontSize: 12, fontWeight: '700', color: '#168447', marginBottom: 8 },
  reportMessage: { fontSize: 14, color: '#333', lineHeight: 20, marginBottom: 14 },
  replyBtn: { backgroundColor: '#168447', padding: 10, borderRadius: 10, alignItems: 'center' },
  replyBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 30, margin: 20, alignItems: 'center', borderWidth: 1, borderColor: '#DCE8DF' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#17201B', marginBottom: 8 },
  emptyText: { color: '#758078', textAlign: 'center', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 35 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#17201B' },
  modalSub: { fontSize: 13, color: '#758078', marginTop: 4, marginBottom: 12 },
  replyInput: { backgroundColor: '#F6F8F7', borderWidth: 1, borderColor: '#DCE8DF', borderRadius: 12, padding: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top', marginBottom: 16 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, padding: 12, borderRadius: 10, alignItems: 'center' },
  cancelBtn: { backgroundColor: '#EDF2EF' },
  cancelBtnText: { color: '#17201B', fontWeight: '700' },
  sendBtn: { backgroundColor: '#168447' },
  sendBtnText: { color: '#FFFFFF', fontWeight: '800' },
});