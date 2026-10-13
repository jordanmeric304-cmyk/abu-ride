import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const API_URL = 'https://abu-ride.onrender.com';

type Earning = {
  id: number;
  amount: number;
  status: string;
  ticket_reference: string;
  destination_name: string | null;
  earned_at?: string;
};

type Summary = {
  total_validated_tickets: number;
  total_earnings: number;
};

export default function DriverEarningsScreen() {
  const [earnings, setEarnings] = useState<Earning[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total_validated_tickets: 0,
    total_earnings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
    try {
      setLoading(true);

      const token = await SecureStore.getItemAsync('auth_token');

      if (!token) {
        router.replace('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/driver/earnings`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert(
          'Error',
          data.message || 'Unable to load earnings.'
        );
        return;
      }

      const list: Earning[] = (data.earnings || []).map((item: any) => ({
        id: item.id,
        amount: Number(item.amount) || 0,
        status: item.status || 'paid',
        ticket_reference: item.ticket_reference || item.reference || `TCK-${item.id}`,
        destination_name: item.destination_name || 'Campus Ride',
        earned_at: item.earned_at
      }));

      setEarnings(list);

      const calculatedTotal = list.reduce(
        (sum, item) => (item.status !== 'cancelled' ? sum + item.amount : sum),
        0
      );
      const calculatedCount = list.filter((item) => item.status !== 'cancelled').length;

      setSummary({
        total_validated_tickets: data.summary?.total_validated_tickets ?? calculatedCount,
        total_earnings: data.summary?.total_earnings ?? calculatedTotal,
      });
    } catch (error) {
      console.log('Driver earnings error:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the ABU Ride server.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <Text style={styles.title}>Earnings</Text>

        <Pressable style={styles.refreshButton} onPress={loadEarnings}>
          <Text style={styles.refreshText}>Refresh</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#176B45" />
          <Text style={styles.loadingText}>Loading earnings...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.totalCard}>
            <Text style={styles.totalLabel}>Total Earnings</Text>
            <Text style={styles.totalAmount}>
              ₦{summary.total_earnings.toLocaleString()}
            </Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statNumber}>
                {summary.total_validated_tickets}
              </Text>
              <Text style={styles.statLabel}>Tickets Validated</Text>
            </View>

            <View style={styles.statCard}>
              <Text style={styles.statNumber}>{earnings.length}</Text>
              <Text style={styles.statLabel}>Earnings Records</Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>Earnings History</Text>

          {earnings.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>No earnings yet</Text>
              <Text style={styles.emptyText}>
                Earnings will appear here after successfully validating passenger QR tickets.
              </Text>
            </View>
          ) : (
            earnings.map((earning) => (
              <View key={earning.id} style={styles.earningCard}>
                <View style={styles.earningTop}>
                  <View style={styles.earningInfo}>
                    <Text style={styles.destination}>
                      {earning.destination_name || 'Bus Trip'}
                    </Text>
                    <Text style={styles.ticketReference}>
                      Ticket: {earning.ticket_reference}
                    </Text>
                  </View>

                  <Text style={styles.amount}>
                    +₦{Number(earning.amount).toLocaleString()}
                  </Text>
                </View>

                <View style={styles.statusRow}>
                  <Text style={styles.statusLabel}>Status</Text>
                  <View
                    style={[
                      styles.statusBadge,
                      earning.status === 'paid' && styles.paidBadge,
                      earning.status === 'pending' && styles.pendingBadge,
                      earning.status === 'cancelled' && styles.cancelledBadge,
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {(earning.status || 'PAID').toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F9F7',
  },
  header: {
    paddingTop: 55,
    paddingHorizontal: 20,
    paddingBottom: 18,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#E1EAE5',
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backText: {
    fontSize: 28,
    color: '#176B45',
    marginTop: -3,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#17211B',
  },
  refreshButton: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refreshText: {
    color: '#176B45',
    fontWeight: '800',
    fontSize: 12,
  },
  content: {
    padding: 20,
    paddingBottom: 45,
  },
  totalCard: {
    backgroundColor: '#176B45',
    borderRadius: 20,
    padding: 24,
    marginBottom: 14,
  },
  totalLabel: {
    color: '#DDEFE6',
    fontSize: 14,
    fontWeight: '600',
  },
  totalAmount: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '900',
    marginTop: 6,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 25,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#DDE8E1',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '900',
    color: '#176B45',
  },
  statLabel: {
    fontSize: 12,
    color: '#64746A',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#17211B',
    marginBottom: 12,
  },
  earningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDE8E1',
  },
  earningTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  earningInfo: {
    flex: 1,
  },
  destination: {
    fontSize: 16,
    fontWeight: '800',
    color: '#176B45',
  },
  ticketReference: {
    fontSize: 11,
    color: '#64746A',
    marginTop: 5,
  },
  amount: {
    fontSize: 18,
    fontWeight: '900',
    color: '#16804A',
    marginLeft: 10,
  },
  statusRow: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#EDF2EE',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 12,
    color: '#64746A',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  paidBadge: {
    backgroundColor: '#DCFCE7',
  },
  pendingBadge: {
    backgroundColor: '#FFF4D6',
  },
  cancelledBadge: {
    backgroundColor: '#FDE8E8',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#176B45',
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 25,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DDE8E1',
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#17211B',
    marginBottom: 7,
  },
  emptyText: {
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#64746A',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#64746A',
  },
});