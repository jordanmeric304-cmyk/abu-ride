import { useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import QRCode from 'react-native-qrcode-svg';

const API_URL = 'http://192.168.204.133:5000';

type Ticket = {
  id: number;
  ticket_reference: string;
  qr_token: string;
  destination: string;
  amount: number;
  status: string;
  purchased_at: string;
  expires_at: string;
};

export default function TicketScreen() {
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTicket();
  }, []);

  const loadTicket = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');

      if (!token) {
        Alert.alert(
          'Login Required',
          'Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/login'),
            },
          ]
        );
        return;
      }

      const response = await fetch(
        `${API_URL}/api/tickets/latest`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert(
          'Unable to load ticket',
          data.message || 'Ticket could not be loaded.'
        );
        return;
      }

      setTicket(data.ticket);
    } catch (error) {
      console.error('Ticket loading error:', error);

      Alert.alert(
        'Connection Error',
        'Could not connect to the ABU Ride server.'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator
            size="large"
            color="#176B45"
          />

          <Text style={styles.loadingText}>
            Loading ticket...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!ticket) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <View style={styles.emptyIcon}>
            <Text style={styles.emptyIconText}>✓</Text>
          </View>

          <Text style={styles.errorTitle}>
            No ticket found
          </Text>

          <Text style={styles.errorText}>
            You have not purchased a bus ticket yet.
          </Text>

          <TouchableOpacity
            style={styles.button}
            activeOpacity={0.85}
            onPress={() => router.replace('/')}
          >
            <Text style={styles.buttonText}>
              BACK TO HOME
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const ticketStatus = ticket.status.toLowerCase();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.7}
          onPress={() => router.replace('/')}
        >
          <Text style={styles.backArrow}>‹</Text>

          <Text style={styles.backText}>
            Back
          </Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <Text style={styles.title}>
            Your Bus Ticket
          </Text>

          <Text style={styles.subtitle}>
            Show this QR code to the driver
          </Text>
        </View>

        {/* Ticket Card */}
        <View style={styles.ticketCard}>
          {/* Ticket Header */}
          <View style={styles.ticketHeader}>
            <View>
              <Text style={styles.destinationLabel}>
                DESTINATION
              </Text>

              <Text style={styles.destination}>
                {ticket.destination}
              </Text>
            </View>

            <View style={styles.statusBadge}>
              <View style={styles.statusDot} />

              <Text style={styles.statusText}>
                {ticketStatus.toUpperCase()}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          {/* QR Code */}
          <View style={styles.qrSection}>
            <View style={styles.qrContainer}>
              <QRCode
                value={ticket.qr_token}
                size={220}
                color="#16352A"
                backgroundColor="#FFFFFF"
              />
            </View>

            <Text style={styles.scanText}>
              Scan this QR code to verify payment
            </Text>
          </View>

          <View style={styles.divider} />

          {/* Fare */}
          <View style={styles.fareBox}>
            <Text style={styles.fareLabel}>
              TICKET FARE
            </Text>

            <Text style={styles.fareValue}>
              ₦{Number(ticket.amount).toLocaleString()}
            </Text>
          </View>

          {/* Ticket Information */}
          <View style={styles.infoSection}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                Ticket Reference
              </Text>

              <Text style={styles.infoValueSmall}>
                {ticket.ticket_reference}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                Payment Status
              </Text>

              <Text style={styles.successValue}>
                PAYMENT CONFIRMED
              </Text>
            </View>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },

  content: {
    padding: 20,
    paddingBottom: 45,
  },

  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  backArrow: {
    color: '#176B45',
    fontSize: 32,
    lineHeight: 30,
    marginRight: 5,
    fontWeight: '300',
  },

  backText: {
    color: '#176B45',
    fontSize: 15,
    fontWeight: '700',
  },

  header: {
    marginBottom: 22,
  },

  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1F2933',
    letterSpacing: -0.5,
  },

  subtitle: {
    color: '#66736C',
    fontSize: 14,
    marginTop: 6,
  },

  ticketCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: '#DCE7E0',

    shadowColor: '#123D2A',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },

  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  destinationLabel: {
    color: '#7A8780',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 5,
  },

  destination: {
    color: '#1F2933',
    fontSize: 22,
    fontWeight: '800',
    maxWidth: 200,
  },

  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F3EC',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 20,
  },

  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#176B45',
    marginRight: 6,
  },

  statusText: {
    color: '#176B45',
    fontSize: 10,
    fontWeight: '800',
  },

  divider: {
    width: '100%',
    height: 1,
    backgroundColor: '#E4ECE7',
    marginVertical: 20,
  },

  qrSection: {
    alignItems: 'center',
  },

  qrContainer: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1EAE4',
  },

  scanText: {
    color: '#66736C',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 14,
  },

  fareBox: {
    backgroundColor: '#F1F7F3',
    borderRadius: 16,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 18,
    alignItems: 'center',
  },

  fareLabel: {
    color: '#66736C',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
  },

  fareValue: {
    color: '#176B45',
    fontSize: 27,
    fontWeight: '900',
  },

  infoSection: {
    width: '100%',
  },

  infoRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },

  infoRowLast: {
    marginBottom: 0,
  },

  infoLabel: {
    color: '#7A8780',
    fontSize: 13,
    flex: 1,
  },

  infoValueSmall: {
    color: '#1F2933',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '58%',
    textAlign: 'right',
  },

  successValue: {
    color: '#176B45',
    fontSize: 11,
    fontWeight: '800',
    maxWidth: '58%',
    textAlign: 'right',
  },

  notice: {
    flexDirection: 'row',
    backgroundColor: '#E8F3EC',
    borderWidth: 1,
    borderColor: '#D4E6DA',
    padding: 16,
    borderRadius: 17,
    marginTop: 18,
  },

  noticeIcon: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#176B45',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 1,
  },

  noticeIconText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },

  noticeContent: {
    flex: 1,
  },

  noticeTitle: {
    color: '#176B45',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },

  noticeText: {
    color: '#526159',
    fontSize: 13,
    lineHeight: 19,
  },

  verificationBox: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE7E0',
    padding: 16,
    borderRadius: 17,
    marginTop: 12,
  },

  verificationMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#176B45',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },

  verificationMarkText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  verificationContent: {
    flex: 1,
  },

  verificationTitle: {
    color: '#1F2933',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },

  verificationText: {
    color: '#66736C',
    fontSize: 12,
    lineHeight: 18,
  },

  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 25,
  },

  loadingText: {
    color: '#66736C',
    marginTop: 12,
    fontSize: 14,
  },

  emptyIcon: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#E8F3EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },

  emptyIconText: {
    color: '#176B45',
    fontSize: 30,
    fontWeight: '800',
  },

  errorTitle: {
    color: '#1F2933',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 7,
  },

  errorText: {
    color: '#66736C',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 22,
  },

  button: {
    backgroundColor: '#176B45',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,

    shadowColor: '#123D2A',
    shadowOffset: {
      width: 0,
      height: 3,
    },
    shadowOpacity: 0.15,
    shadowRadius: 5,
    elevation: 2,
  },

  buttonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
});