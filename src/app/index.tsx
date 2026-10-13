import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import abuLogo from '../../assets/images/abu-logo.png';

const API_URL = 'https://abu-ride.onrender.com';

type Destination = {
  id: number;
  name: string;
  description: string;
  fare: number;
  estimated_minutes: number;
};

type Driver = {
  id: number;
  full_name: string;
  username: string;
  phone: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  is_available: boolean;
  destination_id: number;
  destination_name: string;
  fare: number;
  vehicle_id?: number;
  driver_id?: number;
  available_seats?: number;
};

type User = {
  id: number;
  full_name: string;
  email: string;
  phone?: string;
  role: string;
};

export default function HomeScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [walletBalance, setWalletBalance] = useState(0);

  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [selectedDestination, setSelectedDestination] = useState<Destination | null>(null);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null);

  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const [fundingModalVisible, setFundingModalVisible] = useState(false);
  const [fundingAmount, setFundingAmount] = useState('');
  const [fundingNote, setFundingNote] = useState('');
  const [requestingFunding, setRequestingFunding] = useState(false);

  const [transferModalVisible, setTransferModalVisible] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);

  // --- REPORT MODAL STATE ---
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [reportIssueType, setReportIssueType] = useState('Delay / Boarding Issue');
  const [reportDescription, setReportDescription] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    loadUser();
    loadDestinations();
    loadWallet();

    // Timed notification poller (runs every 30 seconds)
    const notificationInterval = setInterval(() => {
      checkPassengerNotifications();
    }, 30000);

    return () => clearInterval(notificationInterval);
  }, []);

  const loadUser = async () => {
    try {
      const savedUser = await SecureStore.getItemAsync('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.log('Load user error:', error);
    }
  };

  const loadDestinations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/destinations`);
      const data = await response.json();

      if (data.success) {
        setDestinations(data.destinations);
      } else {
        Alert.alert('Error', data.message || 'Failed to load destinations');
      }
    } catch (error) {
      console.log('Destinations error:', error);
      Alert.alert('Connection Error', 'Unable to connect to the ABU Ride server.');
    }
  };

  const loadWallet = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/wallet`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (data.success && data.wallet) {
        setWalletBalance(Number(data.wallet.balance || 0));
      }
    } catch (error) {
      console.log('Wallet error:', error);
    }
  };

  // --- TIMED NOTIFICATION CHECKER ---
  const checkPassengerNotifications = async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (!token) return;

      const response = await fetch(`${API_URL}/api/notifications/unread`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (data.success && data.notifications && data.notifications.length > 0) {
        const latestNotif = data.notifications[0];
        Alert.alert(latestNotif.title || 'Ride Update 🚗', latestNotif.message);
      }
    } catch (error) {
      // Background check error ignored silently
    }
  };

  const loadDrivers = async (destinationId: number) => {
    setLoadingDrivers(true);
    setSelectedDriver(null);
    setDrivers([]);

    try {
      const token = await SecureStore.getItemAsync('auth_token');

      const response = await fetch(
        `${API_URL}/api/driver/active-vehicles?destination_id=${destinationId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      const data = await response.json();

      if (data.success && data.vehicles) {
        const mapped = data.vehicles.map((v: any) => {
          const rawName = v.driver_name || v.username || 'driver';
          const cleanUsername = rawName.startsWith('@') ? rawName.slice(1) : rawName;
          const vehNo = v.vehicle_number || (v.vehicle_id ? `Vehicle ${v.vehicle_id}` : 'Unassigned');
          const availSeats = v.available_seats ?? 10;
          const bookedSeats = 10 - availSeats;

          // Check for 8-Seat Threshold alert
          if (bookedSeats >= 8) {
            Alert.alert(
              'Boarding Urgent! 🏃‍♂️',
              `Vehicle ${vehNo} serving ${selectedDestination?.name || 'your destination'} now has ${bookedSeats} seats booked! Please make your way to the boarding point immediately.`
            );
          }

          return {
            id: v.driver_id || v.vehicle_id,
            driver_id: v.driver_id,
            vehicle_id: v.vehicle_id,
            full_name: cleanUsername,
            username: cleanUsername,
            phone: null,
            vehicle_number: vehNo,
            vehicle_type: `Vehicle ${vehNo}`,
            is_available: true,
            destination_id: destinationId,
            destination_name: selectedDestination?.name || '',
            fare: selectedDestination?.fare || 0,
            available_seats: availSeats,
          };
        });

        setDrivers(mapped);
      } else {
        setDrivers([]);
      }
    } catch (error) {
      console.log('Available drivers error:', error);
      setDrivers([]);
    } finally {
      setLoadingDrivers(false);
    }
  };

  const selectDestination = (destination: Destination) => {
    setSelectedDestination(destination);
    loadDrivers(destination.id);
  };

  const selectDriver = (driver: Driver) => {
    setSelectedDriver(driver);
  };

  const purchaseTicket = async () => {
    if (!selectedDestination) {
      Alert.alert('Select destination', 'Please select a destination first.');
      return;
    }

    if (!selectedDriver) {
      Alert.alert('Select driver', 'Please select an available driver first.');
      return;
    }

    const fare = Number(selectedDestination.fare);

    if (walletBalance < fare) {
      Alert.alert(
        'Insufficient balance',
        `Your wallet balance is ₦${walletBalance.toLocaleString()} but this trip costs ₦${fare.toLocaleString()}.`,
        [
          { text: 'Top Up', onPress: () => setFundingModalVisible(true) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    try {
      setPurchasing(true);
      const token = await SecureStore.getItemAsync('auth_token');

      if (!token) {
        Alert.alert('Session expired', 'Please log in again.');
        router.replace('/login');
        return;
      }

      const purchaseTimestamp = new Date().toISOString();

      const response = await fetch(`${API_URL}/api/tickets/purchase`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          destination_id: selectedDestination.id,
          driver_id: selectedDriver.driver_id || selectedDriver.id,
          vehicle_id: selectedDriver.vehicle_id,
          purchase_time: purchaseTimestamp,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert('Purchase failed', data.message || 'Unable to purchase ticket.');
        return;
      }

      setWalletBalance(Number(data.wallet.balance_after));

      const formattedTime = new Date(purchaseTimestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      Alert.alert(
        'Payment Successful',
        `Fare of ₦${fare.toLocaleString()} paid at ${formattedTime}. Driver: @${selectedDriver.username}.`,
        [
          {
            text: 'View QR Ticket',
            onPress: () => router.replace('/ticket'),
          },
        ]
      );
    } catch (error) {
      console.log('Purchase error:', error);
      Alert.alert('Connection Error', 'Unable to connect to the ABU Ride server.');
    } finally {
      setPurchasing(false);
    }
  };

  const topUpWallet = async () => {
    const amount = Number(fundingAmount);

    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid top-up amount.');
      return;
    }

    try {
      setRequestingFunding(true);
      const token = await SecureStore.getItemAsync('auth_token');

      if (!token) {
        Alert.alert('Session expired', 'Please log in again.');
        router.replace('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/wallet/topup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ amount }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert('Top-up failed', data.message || 'Unable to fund wallet.');
        return;
      }

      setWalletBalance(Number(data.balance));
      setFundingModalVisible(false);
      setFundingAmount('');
      setFundingNote('');

      Alert.alert('Top-Up Successful', `₦${amount.toLocaleString()} has been added to your wallet.`);
      loadWallet();
    } catch (error) {
      console.log('Top-up error:', error);
      Alert.alert('Connection Error', 'Unable to connect to the ABU Ride server.');
    } finally {
      setRequestingFunding(false);
    }
  };

  const transferFunds = async () => {
    const email = recipientEmail.trim().toLowerCase();
    const amount = Number(transferAmount);

    if (!email) {
      Alert.alert('Recipient required', 'Enter the email address of the passenger you want to send funds to.');
      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid transfer amount.');
      return;
    }

    if (amount > walletBalance) {
      Alert.alert('Insufficient balance', `Your wallet balance is ₦${walletBalance.toLocaleString()}.`);
      return;
    }

    try {
      setTransferring(true);
      const token = await SecureStore.getItemAsync('auth_token');

      if (!token) {
        Alert.alert('Session expired', 'Please log in again.');
        router.replace('/login');
        return;
      }

      const response = await fetch(`${API_URL}/api/wallet/transfer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          recipient_email: email,
          amount,
          note: transferNote.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert('Transfer failed', data.message || 'Unable to transfer funds.');
        return;
      }

      setWalletBalance(Number(data.transfer.balance_after));
      setTransferModalVisible(false);
      setRecipientEmail('');
      setTransferAmount('');
      setTransferNote('');

      Alert.alert('Transfer Successful', `₦${amount.toLocaleString()} has been sent to ${data.transfer.recipient_name}.`);
    } catch (error) {
      console.log('Transfer error:', error);
      Alert.alert('Connection Error', 'Unable to connect to the ABU Ride server.');
    } finally {
      setTransferring(false);
    }
  };

  // --- SUBMIT REPORT FUNCTION ---
  const submitIssueReport = async () => {
    if (!reportDescription.trim()) {
      Alert.alert('Error', 'Please describe the issue in detail.');
      return;
    }

    try {
      setSubmittingReport(true);
      const token = await SecureStore.getItemAsync('auth_token');

      const response = await fetch(`${API_URL}/api/notifications/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          role: 'passenger',
          issue_type: reportIssueType,
          description: reportDescription,
        }),
      });

      const data = await response.json();

      if (data.success) {
        Alert.alert('Report Submitted', 'Your issue report has been logged to the admin team.');
        setReportDescription('');
        setReportModalVisible(false);
      } else {
        Alert.alert('Error', data.message || 'Failed to submit report.');
      }
    } catch (error) {
      console.log('Report error:', error);
      Alert.alert('Connection Error', 'Unable to connect to the ABU Ride server.');
    } finally {
      setSubmittingReport(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* BRAND HEADER */}
        <View style={styles.brandHeader}>
          <View style={styles.brandLeft}>
            <Image source={abuLogo} style={styles.logo} resizeMode="contain" />
            <Text style={styles.appName}>ABU Ride</Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={() => router.push('/profile')}
          >
            <Text style={styles.profileButtonText}>
              {user?.full_name?.charAt(0).toUpperCase() || 'P'}
            </Text>
          </Pressable>
        </View>

        {/* WELCOME */}
        <View style={styles.welcomeHeader}>
          <Text style={styles.smallText}>Welcome back</Text>
          <Text style={styles.userName}>{user?.full_name || 'Passenger'}</Text>
        </View>

        {/* WALLET */}
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.walletAmount}>
            ₦{walletBalance.toLocaleString()}
          </Text>

          <View style={styles.walletActions}>
            <Pressable
              style={styles.fundButton}
              onPress={() => setFundingModalVisible(true)}
            >
              <Text style={styles.fundButtonText}>Top Up</Text>
            </Pressable>

            <Pressable
              style={styles.transferButton}
              onPress={() => setTransferModalVisible(true)}
            >
              <Text style={styles.transferButtonText}>Transfer Funds</Text>
            </Pressable>
          </View>
        </View>

        {/* DESTINATIONS */}
        <Text style={styles.sectionTitle}>Choose Your Destination</Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.destinationScroll}
        >
          {destinations.map((destination) => {
            const selected = selectedDestination?.id === destination.id;

            return (
              <Pressable
                key={destination.id}
                style={[
                  styles.destinationCard,
                  selected && styles.destinationCardSelected,
                ]}
                onPress={() => selectDestination(destination)}
              >
                <Text
                  style={[
                    styles.destinationName,
                    selected && styles.destinationNameSelected,
                  ]}
                >
                  {destination.name}
                </Text>

                <Text
                  style={[
                    styles.destinationFare,
                    selected && styles.destinationFareSelected,
                  ]}
                >
                  ₦{Number(destination.fare).toLocaleString()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* SELECTED DESTINATION */}
        {selectedDestination && (
          <View style={styles.selectedDestinationBox}>
            <Text style={styles.selectedLabel}>Selected destination</Text>
            <Text style={styles.selectedDestination}>
              {selectedDestination.name}
            </Text>
            <Text style={styles.selectedFare}>
              Fare: ₦{Number(selectedDestination.fare).toLocaleString()}
            </Text>
          </View>
        )}

        {/* AVAILABLE DRIVERS */}
        <View style={styles.driverHeader}>
          <Text style={styles.sectionTitle}>Available Drivers</Text>
          {selectedDestination && (
            <Text style={styles.driverCount}>
              {drivers.length} available
            </Text>
          )}
        </View>

        {!selectedDestination ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Select a destination</Text>
          </View>
        ) : loadingDrivers ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>Loading drivers...</Text>
            <Text style={styles.emptyText}>
              Looking for drivers serving {selectedDestination.name}.
            </Text>
          </View>
        ) : drivers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>No available drivers</Text>
            <Text style={styles.emptyText}>
              There are currently no drivers available for{' '}
              {selectedDestination.name}.
            </Text>
          </View>
        ) : (
          drivers.map((driver) => {
            const selected = selectedDriver?.id === driver.id;

            return (
              <Pressable
                key={driver.id}
                style={[
                  styles.driverCard,
                  selected && styles.driverCardSelected,
                ]}
                onPress={() => selectDriver(driver)}
              >
                <View style={styles.driverAvatar}>
                  <Text style={styles.driverAvatarText}>
                    {driver.username ? driver.username.charAt(0).toUpperCase() : '🚌'}
                  </Text>
                </View>

                <View style={styles.driverInfo}>
                  <Text style={styles.driverName}>
                    {driver.vehicle_number ? `${driver.vehicle_number} ` : ''}
                    @{driver.username}
                  </Text>

                  <Text style={styles.driverVehicle}>
                    {driver.vehicle_type}
                  </Text>

                  <Text style={styles.driverRoute}>
                    Serving {driver.destination_name}
                  </Text>
                </View>

                <View style={styles.driverStatus}>
                  <View style={styles.onlineDot} />
                  <Text style={styles.onlineText}>
                    {driver.available_seats !== undefined
                      ? `${driver.available_seats} Seats`
                      : 'Available'}
                  </Text>
                </View>
              </Pressable>
            );
          })
        )}

        {/* SELECTED DRIVER */}
        {selectedDriver && (
          <View style={styles.selectedDriverBox}>
            <Text style={styles.selectedDriverLabel}>
              Selected Fleet Vehicle & Driver
            </Text>

            <Text style={styles.selectedDriverName}>
              {selectedDriver.vehicle_number ? `${selectedDriver.vehicle_number} ` : ''}
              @{selectedDriver.username}
            </Text>

            <Text style={styles.selectedDriverDetails}>
              Driver Username: @{selectedDriver.username}
            </Text>

            <View style={styles.paymentSummary}>
              <View>
                <Text style={styles.summaryLabel}>Destination</Text>
                <Text style={styles.summaryValue}>
                  {selectedDestination?.name}
                </Text>
              </View>

              <View style={styles.summaryRight}>
                <Text style={styles.summaryLabel}>Fare</Text>
                <Text style={styles.summaryAmount}>
                  ₦{Number(selectedDestination?.fare || 0).toLocaleString()}
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.continueButton,
                purchasing && styles.disabledButton,
              ]}
              onPress={purchaseTicket}
              disabled={purchasing}
            >
              <Text style={styles.continueButtonText}>
                {purchasing
                  ? 'Processing Payment...'
                  : `Pay ₦${Number(selectedDestination?.fare || 0).toLocaleString()} & Get Ticket`}
              </Text>
            </Pressable>
          </View>
        )}

        {/* QUICK ACCESS */}
        <View style={styles.quickAccess}>
          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/ticket')}
          >
            <Text style={styles.quickTitle}>My Ticket</Text>
            <Text style={styles.quickText}>
              View your latest QR ticket
            </Text>
          </Pressable>

          <Pressable
            style={styles.quickCard}
            onPress={() => router.push('/transactions')}
          >
            <Text style={styles.quickTitle}>Transactions</Text>
            <Text style={styles.quickText}>
              View wallet transactions
            </Text>
          </Pressable>

          <Pressable
            style={[styles.quickCard, styles.reportQuickCard]}
            onPress={() => setReportModalVisible(true)}
          >
            <Text style={styles.reportQuickTitle}>Report Issue ⚠️</Text>
            <Text style={styles.quickText}>
              Log complaints to admin
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* FUNDING REQUEST MODAL */}
      <Modal
        visible={fundingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setFundingModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Top Up Wallet</Text>
            <Text style={styles.modalText}>
              Enter the amount you want to add to your wallet.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Amount e.g. 1000"
              keyboardType="numeric"
              value={fundingAmount}
              onChangeText={setFundingAmount}
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setFundingModalVisible(false)}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={styles.submitButton}
                onPress={topUpWallet}
                disabled={requestingFunding}
              >
                <Text style={styles.submitText}>
                  {requestingFunding ? 'Sending...' : 'Top Up Now'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* TRANSFER FUNDS MODAL */}
      <Modal
        visible={transferModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setTransferModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Transfer Funds</Text>
            <Text style={styles.modalText}>
              Send money directly from your wallet to another ABU Ride passenger.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Passenger email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={recipientEmail}
              onChangeText={setRecipientEmail}
            />

            <TextInput
              style={styles.input}
              placeholder="Amount e.g. 200"
              keyboardType="numeric"
              value={transferAmount}
              onChangeText={setTransferAmount}
            />

            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Note (optional)"
              value={transferNote}
              onChangeText={setTransferNote}
              multiline
            />

            <Text style={styles.transferBalanceText}>
              Available balance: ₦{walletBalance.toLocaleString()}
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setTransferModalVisible(false)}
                disabled={transferring}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.submitButton,
                  transferring && styles.disabledButton,
                ]}
                onPress={transferFunds}
                disabled={transferring}
              >
                <Text style={styles.submitText}>
                  {transferring ? 'Transferring...' : 'Transfer'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* REPORT ISSUE MODAL */}
      <Modal
        visible={reportModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setReportModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Report an Issue ⚠️</Text>
            <Text style={styles.modalText}>
              Report delays, misconduct, or app bugs directly to the ABU Ride admin.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Issue Category e.g. Delay, Misconduct"
              value={reportIssueType}
              onChangeText={setReportIssueType}
            />

            <TextInput
              style={[styles.input, styles.noteInput]}
              placeholder="Describe what happened..."
              value={reportDescription}
              onChangeText={setReportDescription}
              multiline
            />

            <View style={styles.modalButtons}>
              <Pressable
                style={styles.cancelButton}
                onPress={() => setReportModalVisible(false)}
                disabled={submittingReport}
              >
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.reportSubmitButton,
                  submittingReport && styles.disabledButton,
                ]}
                onPress={submitIssueReport}
                disabled={submittingReport}
              >
                <Text style={styles.submitText}>
                  {submittingReport ? 'Submitting...' : 'Submit Report'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F8F6',
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },
  brandHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  brandLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 44,
    height: 44,
    marginRight: 10,
  },
  appName: {
    fontSize: 21,
    fontWeight: '800',
    color: '#176B45',
    letterSpacing: -0.3,
  },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E8F3EC',
    borderWidth: 1,
    borderColor: '#CFE1D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileButtonText: {
    color: '#176B45',
    fontSize: 17,
    fontWeight: '800',
  },
  welcomeHeader: {
    marginBottom: 20,
  },
  smallText: {
    fontSize: 14,
    color: '#6B756F',
    marginBottom: 4,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#176B45',
  },
  walletCard: {
    backgroundColor: '#176B45',
    borderRadius: 20,
    padding: 22,
    marginBottom: 25,
  },
  walletLabel: {
    color: '#DCEFE5',
    fontSize: 14,
  },
  walletAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 6,
    marginBottom: 18,
  },
  walletActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fundButton: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    alignItems: 'center',
  },
  fundButtonText: {
    color: '#176B45',
    fontWeight: '700',
    fontSize: 13,
  },
  transferButton: {
    flex: 1,
    backgroundColor: '#0F5132',
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    alignItems: 'center',
  },
  transferButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#176B45',
    marginBottom: 12,
  },
  destinationScroll: {
    paddingBottom: 8,
  },
  destinationCard: {
    width: 150,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#DCE7E0',
  },
  destinationCardSelected: {
    backgroundColor: '#176B45',
    borderColor: '#176B45',
  },
  destinationName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#176B45',
    marginBottom: 10,
  },
  destinationNameSelected: {
    color: '#FFFFFF',
  },
  destinationFare: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1F2933',
  },
  destinationFareSelected: {
    color: '#FFFFFF',
  },
  selectedDestinationBox: {
    backgroundColor: '#E8F3EC',
    borderRadius: 14,
    padding: 16,
    marginTop: 15,
    marginBottom: 22,
  },
  selectedLabel: {
    fontSize: 12,
    color: '#66736C',
    marginBottom: 4,
  },
  selectedDestination: {
    fontSize: 20,
    fontWeight: '800',
    color: '#176B45',
  },
  selectedFare: {
    marginTop: 5,
    fontSize: 14,
    color: '#52605A',
  },
  driverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  driverCount: {
    color: '#66736C',
    fontSize: 13,
    marginBottom: 12,
  },
  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 25,
    alignItems: 'center',
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E1E9E4',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#176B45',
    marginBottom: 7,
  },
  emptyText: {
    fontSize: 13,
    color: '#6B756F',
    textAlign: 'center',
    lineHeight: 20,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#DCE7E0',
  },
  driverCardSelected: {
    borderColor: '#176B45',
    backgroundColor: '#F0F7F3',
  },
  driverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#DDEDE4',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverAvatarText: {
    color: '#176B45',
    fontSize: 19,
    fontWeight: '800',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2933',
  },
  driverVehicle: {
    fontSize: 12,
    color: '#52605A',
    marginTop: 4,
  },
  driverRoute: {
    fontSize: 12,
    color: '#66736C',
    marginTop: 3,
  },
  driverStatus: {
    alignItems: 'center',
    marginLeft: 8,
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#2E8B57',
    marginBottom: 4,
  },
  onlineText: {
    fontSize: 10,
    color: '#237A4B',
    fontWeight: '700',
  },
  selectedDriverBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginTop: 8,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#176B45',
  },
  selectedDriverLabel: {
    fontSize: 12,
    color: '#66736C',
  },
  selectedDriverName: {
    fontSize: 20,
    fontWeight: '800',
    color: '#176B45',
    marginTop: 4,
  },
  selectedDriverDetails: {
    fontSize: 13,
    color: '#52605A',
    marginTop: 4,
    marginBottom: 16,
  },
  paymentSummary: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: '#F3F8F5',
    borderRadius: 12,
    padding: 14,
    marginBottom: 15,
  },
  summaryLabel: {
    fontSize: 11,
    color: '#66736C',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#176B45',
  },
  summaryRight: {
    alignItems: 'flex-end',
  },
  summaryAmount: {
    fontSize: 17,
    fontWeight: '800',
    color: '#176B45',
  },
  continueButton: {
    backgroundColor: '#176B45',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  quickAccess: {
    flexDirection: 'row',
    gap: 10,
  },
  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#DCE7E0',
  },
  quickTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#176B45',
  },
  reportQuickCard: {
    borderColor: '#F5C6CB',
    backgroundColor: '#FFF5F5',
  },
  reportQuickTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#D9534F',
  },
  quickText: {
    fontSize: 11,
    color: '#6B756F',
    marginTop: 5,
    lineHeight: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 22,
    paddingBottom: 35,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#176B45',
  },
  modalText: {
    fontSize: 14,
    color: '#66736C',
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 18,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D4E1D9',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    marginBottom: 12,
    color: '#1F2933',
  },
  noteInput: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  transferBalanceText: {
    fontSize: 13,
    color: '#176B45',
    fontWeight: '700',
    marginBottom: 12,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 5,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#EDF2EF',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#52605A',
    fontWeight: '700',
  },
  submitButton: {
    flex: 1,
    backgroundColor: '#176B45',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  reportSubmitButton: {
    flex: 1,
    backgroundColor: '#D9534F',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});