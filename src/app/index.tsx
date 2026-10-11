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
  phone: string | null;
  vehicle_number: string | null;
  vehicle_type: string | null;
  is_available: boolean;
  destination_id: number;
  destination_name: string;
  fare: number;
  vehicle_id?: number;
  driver_id?: number;
  driver_custom_id?: string;
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
  const [selectedDestination, setSelectedDestination] =
    useState<Destination | null>(null);

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [selectedDriver, setSelectedDriver] =
    useState<Driver | null>(null);

  const [loadingDrivers, setLoadingDrivers] = useState(false);
  const [purchasing, setPurchasing] = useState(false);

  const [fundingModalVisible, setFundingModalVisible] =
    useState(false);

  const [fundingAmount, setFundingAmount] = useState('');
  const [fundingNote, setFundingNote] = useState('');
  const [requestingFunding, setRequestingFunding] =
    useState(false);

  const [transferModalVisible, setTransferModalVisible] =
    useState(false);

  const [recipientEmail, setRecipientEmail] =
    useState('');

  const [transferAmount, setTransferAmount] =
    useState('');

  const [transferNote, setTransferNote] =
    useState('');

  const [transferring, setTransferring] =
    useState(false);

  useEffect(() => {
    loadUser();
    loadDestinations();
    loadWallet();
  }, []);

  const loadUser = async () => {
    try {
      const savedUser =
        await SecureStore.getItemAsync('user');

      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch (error) {
      console.log('Load user error:', error);
    }
  };

  const loadDestinations = async () => {
    try {
      const response = await fetch(
        `${API_URL}/api/destinations`
      );

      const data = await response.json();

      if (data.success) {
        setDestinations(data.destinations);
      } else {
        Alert.alert(
          'Error',
          data.message ||
            'Failed to load destinations'
        );
      }
    } catch (error) {
      console.log(
        'Destinations error:',
        error
      );

      Alert.alert(
        'Connection Error',
        'Unable to connect to the ABU Ride server.'
      );
    }
  };

  const loadWallet = async () => {
    try {
      const token =
        await SecureStore.getItemAsync(
          'auth_token'
        );

      if (!token) {
        return;
      }

      const response = await fetch(
        `${API_URL}/api/wallet`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (
        data.success &&
        data.wallet
      ) {
        setWalletBalance(
          Number(
            data.wallet.balance || 0
          )
        );
      }
    } catch (error) {
      console.log(
        'Wallet error:',
        error
      );
    }
  };
// ============================================================
// GET ACTIVE VEHICLES FOR PASSENGERS (Shows Driver Username & Vehicle)
// ============================================================

router.get('/active-vehicles', authMiddleware, async (req, res) => {
  try {
    const { destination_id } = req.query;

    // 1. Fetch all active vehicles checked in with a driver
    const { data: vehicles, error: vehicleError } = await supabase
      .from('vehicles')
      .select('*')
      .eq('is_active', true)
      .not('current_driver_id', 'is', null);

    if (vehicleError) {
      console.error('Fetch active vehicles error:', vehicleError);
      return res.status(400).json({ success: false, message: 'Could not fetch active vehicles' });
    }

    if (!vehicles || vehicles.length === 0) {
      return res.json({ success: true, vehicles: [] });
    }

    // 2. Extract driver user IDs
    const driverIds = vehicles.map(v => v.current_driver_id).filter(Boolean);

    // 3. Fetch driver profiles and user credentials (username + full_name)
    const { data: driverProfiles } = await supabase
      .from('driver_profiles')
      .select('user_id, destination_id, driver_license_number')
      .in('user_id', driverIds);

    const { data: users } = await supabase
      .from('users')
      .select('id, username, full_name, email, phone')
      .in('id', driverIds);

    // 4. Combine data cleanly using actual username
    const formattedVehicles = vehicles.map(vehicle => {
      const profile = (driverProfiles || []).find(p => p.user_id === vehicle.current_driver_id);
      const user = (users || []).find(u => u.id === vehicle.current_driver_id);

      // Filter by requested destination if supplied
      if (destination_id && Number(profile?.destination_id) !== Number(destination_id)) {
        return null;
      }

      // Prioritize username over full_name
      const driverUsername = user?.username || user?.full_name || 'Driver';

      return {
        vehicle_id: vehicle.id,
        vehicle_number: vehicle.vehicle_number || `Vehicle ${vehicle.id}`,
        driver_id: vehicle.current_driver_id,
        driver_name: driverUsername,
        driver_custom_id: `DRV-${user?.id || vehicle.current_driver_id}`,
        destination_id: profile?.destination_id || null,
        available_seats: 10,
      };
    }).filter(Boolean);

    return res.json({ success: true, vehicles: formattedVehicles });
  } catch (error) {
    console.error('Active vehicles endpoint error:', error);
    return res.status(500).json({ success: false, message: 'Server error while fetching active vehicles' });
  }
});
  
  const selectDestination = (
    destination: Destination
  ) => {
    setSelectedDestination(
      destination
    );

    loadDrivers(
      destination.id
    );
  };

  const selectDriver = (
    driver: Driver
  ) => {
    setSelectedDriver(driver);
  };
const purchaseTicket = async () => {
    if (!selectedDestination) {
      Alert.alert(
        'Select destination',
        'Please select a destination first.'
      );
      return;
    }

    if (!selectedDriver) {
      Alert.alert(
        'Select driver',
        'Please select an available driver first.'
      );
      return;
    }

    const fare = Number(
      selectedDestination.fare
    );

    if (walletBalance < fare) {
      Alert.alert(
        'Insufficient balance',
        `Your wallet balance is ₦${walletBalance.toLocaleString()} but this trip costs ₦${fare.toLocaleString()}.`,
        [
          {
            text: 'Top Up',
            onPress: () =>
              setFundingModalVisible(true),
          },
          {
            text: 'Cancel',
            style: 'cancel',
          },
        ]
      );

      return;
    }

    try {
      setPurchasing(true);

      const token =
        await SecureStore.getItemAsync(
          'auth_token'
        );

      if (!token) {
        Alert.alert(
          'Session expired',
          'Please log in again.'
        );

        router.replace('/login');

        return;
      }

      // Generate accurate ISO timestamp when payment is submitted
      const purchaseTimestamp = new Date().toISOString();

      const response = await fetch(
        `${API_URL}/api/tickets/purchase`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            destination_id:
              selectedDestination.id,
            driver_id:
              selectedDriver.driver_id || selectedDriver.id,
            vehicle_id: selectedDriver.vehicle_id,
            purchase_time: purchaseTimestamp,
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        Alert.alert(
          'Purchase failed',
          data.message ||
            'Unable to purchase ticket.'
        );

        return;
      }

      setWalletBalance(
        Number(
          data.wallet.balance_after
        )
      );

      const formattedTime = new Date(purchaseTimestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      Alert.alert(
        'Payment Successful',
        `Fare of ₦${fare.toLocaleString()} paid at ${formattedTime}. Driver: ${selectedDriver.full_name || 'Assigned Driver'}.`,
        [
          {
            text: 'View QR Ticket',
            onPress: () => {
              router.replace('/ticket');
            },
          },
        ]
      );
    } catch (error) {
      console.log(
        'Purchase error:',
        error
      );

      Alert.alert(
        'Connection Error',
        'Unable to connect to the ABU Ride server.'
      );
    } finally {
      setPurchasing(false);
    }
  };

  const topUpWallet = async () => {
    const amount = Number(fundingAmount);

    if (!amount || amount <= 0) {
      Alert.alert(
        'Invalid amount',
        'Enter a valid top-up amount.'
      );
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

      const response = await fetch(
        `${API_URL}/api/wallet/topup`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ amount }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert(
          'Top-up failed',
          data.message || 'Unable to fund wallet.'
        );
        return;
      }

      setWalletBalance(Number(data.balance));

      setFundingModalVisible(false);
      setFundingAmount('');
      setFundingNote('');

      Alert.alert(
        'Top-Up Successful',
        `₦${amount.toLocaleString()} has been added to your wallet.`
      );

      loadWallet();
    } catch (error) {
      console.log('Top-up error:', error);
      Alert.alert(
        'Connection Error',
        'Unable to connect to the ABU Ride server.'
      );
    } finally {
      setRequestingFunding(false);
    }
  };

  const transferFunds = async () => {
    const email =
      recipientEmail.trim().toLowerCase();

    const amount =
      Number(transferAmount);

    if (!email) {
      Alert.alert(
        'Recipient required',
        'Enter the email address of the passenger you want to send funds to.'
      );

      return;
    }

    if (!amount || amount <= 0) {
      Alert.alert(
        'Invalid amount',
        'Enter a valid transfer amount.'
      );

      return;
    }

    if (amount > walletBalance) {
      Alert.alert(
        'Insufficient balance',
        `Your wallet balance is ₦${walletBalance.toLocaleString()}.`
      );

      return;
    }

    try {
      setTransferring(true);

      const token =
        await SecureStore.getItemAsync(
          'auth_token'
        );

      if (!token) {
        Alert.alert(
          'Session expired',
          'Please log in again.'
        );

        router.replace('/login');

        return;
      }

      const response = await fetch(
        `${API_URL}/api/wallet/transfer`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json',
            Authorization:
              `Bearer ${token}`,
          },
          body: JSON.stringify({
            recipient_email: email,
            amount,
            note: transferNote.trim(),
          }),
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        Alert.alert(
          'Transfer failed',
          data.message ||
            'Unable to transfer funds.'
        );

        return;
      }

      setWalletBalance(
        Number(
          data.transfer.balance_after
        )
      );

      setTransferModalVisible(false);
      setRecipientEmail('');
      setTransferAmount('');
      setTransferNote('');

      Alert.alert(
        'Transfer Successful',
        `₦${amount.toLocaleString()} has been sent to ${data.transfer.recipient_name}.`
      );
    } catch (error) {
      console.log(
        'Transfer error:',
        error
      );

      Alert.alert(
        'Connection Error',
        'Unable to connect to the ABU Ride server.'
      );
    } finally {
      setTransferring(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={
          false
        }
      >
        {/* BRAND HEADER */}
        <View style={styles.brandHeader}>
          <View style={styles.brandLeft}>
            <Image
              source={abuLogo}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={styles.appName}>
              ABU Ride
            </Text>
          </View>

          <Pressable
            style={styles.profileButton}
            onPress={() =>
              router.push('/profile')
            }
          >
            <Text
              style={
                styles.profileButtonText
              }
            >
              {user?.full_name
                ?.charAt(0)
                .toUpperCase() || 'P'}
            </Text>
          </Pressable>
        </View>

        {/* WELCOME */}
        <View style={styles.welcomeHeader}>
          <Text style={styles.smallText}>
            Welcome back
          </Text>

          <Text style={styles.userName}>
            {user?.full_name ||
              'Passenger'}
          </Text>
        </View>

        {/* WALLET */}
        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>
            Wallet Balance
          </Text>

          <Text style={styles.walletAmount}>
            ₦{walletBalance.toLocaleString()}
          </Text>

          <View style={styles.walletActions}>
            <Pressable
              style={styles.fundButton}
              onPress={() =>
                setFundingModalVisible(
                  true
                )
              }
            >
              <Text
                style={
                  styles.fundButtonText
                }
              >
                Top Up
              </Text>
            </Pressable>

            <Pressable
              style={styles.transferButton}
              onPress={() =>
                setTransferModalVisible(
                  true
                )
              }
            >
              <Text
                style={
                  styles.transferButtonText
                }
              >
                Transfer Funds
              </Text>
            </Pressable>
          </View>
        </View>

        {/* DESTINATIONS */}
        <Text style={styles.sectionTitle}>
          Choose Your Destination
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.destinationScroll
          }
        >
          {destinations.map(
            (destination) => {
              const selected =
                selectedDestination?.id ===
                destination.id;

              return (
                <Pressable
                  key={
                    destination.id
                  }
                  style={[
                    styles.destinationCard,
                    selected &&
                      styles.destinationCardSelected,
                  ]}
                  onPress={() =>
                    selectDestination(
                      destination
                    )
                  }
                >
                  <Text
                    style={[
                      styles.destinationName,
                      selected &&
                        styles.destinationNameSelected,
                    ]}
                  >
                    {
                      destination.name
                    }
                  </Text>

                  <Text
                    style={[
                      styles.destinationFare,
                      selected &&
                        styles.destinationFareSelected,
                    ]}
                  >
                    ₦
                    {Number(
                      destination.fare
                    ).toLocaleString()}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        {/* SELECTED DESTINATION */}
        {selectedDestination && (
          <View
            style={
              styles.selectedDestinationBox
            }
          >
            <Text
              style={
                styles.selectedLabel
              }
            >
              Selected destination
            </Text>

            <Text
              style={
                styles.selectedDestination
              }
            >
              {
                selectedDestination.name
              }
            </Text>

            <Text
              style={
                styles.selectedFare
              }
            >
              Fare: ₦
              {Number(
                selectedDestination.fare
              ).toLocaleString()}
            </Text>
          </View>
        )}

        {/* AVAILABLE DRIVERS */}
        <View
          style={
            styles.driverHeader
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Available Drivers
          </Text>

          {selectedDestination && (
            <Text
              style={
                styles.driverCount
              }
            >
              {drivers.length}{' '}
              available
            </Text>
          )}
        </View>

        {!selectedDestination ? (
          <View
            style={styles.emptyBox}
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Select a destination
            </Text>
          </View>
        ) : loadingDrivers ? (
          <View
            style={styles.emptyBox}
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              Loading drivers...
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Looking for drivers
              serving{' '}
              {
                selectedDestination.name
              }.
            </Text>
          </View>
        ) : drivers.length ===
          0 ? (
          <View
            style={styles.emptyBox}
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No available drivers
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              There are currently no
              drivers available for{' '}
              {
                selectedDestination.name
              }.
            </Text>
          </View>
       ) : (
          drivers.map((driver) => {
            const selected =
              selectedDriver?.id ===
              driver.id;

            const displayName =
              driver.full_name || driver.driver_custom_id || 'Assigned Driver';

            return (
              <Pressable
                key={driver.id}
                style={[
                  styles.driverCard,
                  selected &&
                    styles.driverCardSelected,
                ]}
                onPress={() =>
                  selectDriver(
                    driver
                  )
                }
              >
                <View
                  style={
                    styles.driverAvatar
                  }
                >
                  <Text
                    style={
                      styles.driverAvatarText
                    }
                  >
                    {displayName.charAt(0).toUpperCase()}
                  </Text>
                </View>

                <View
                  style={
                    styles.driverInfo
                  }
                >
                  <Text
                    style={
                      styles.driverName
                    }
                  >
                    {driver.vehicle_number ? `${driver.vehicle_number} • ` : ''}
                    {displayName}
                  </Text>

                  <Text
                    style={
                      styles.driverVehicle
                    }
                  >
                    Driver Name: {displayName}
                  </Text>

                  <Text
                    style={
                      styles.driverRoute
                    }
                  >
                    Serving {driver.destination_name}
                  </Text>
                </View>

                <View
                  style={
                    styles.driverStatus
                  }
                >
                  <View
                    style={
                      styles.onlineDot
                    }
                  />

                  <Text
                    style={
                      styles.onlineText
                    }
                  >
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
          <View
            style={
              styles.selectedDriverBox
            }
          >
            <Text
              style={
                styles.selectedDriverLabel
              }
            >
              Selected Fleet Vehicle & Driver
            </Text>

            <Text
              style={
                styles.selectedDriverName
              }
            >
              {selectedDriver.vehicle_number ? `${selectedDriver.vehicle_number} • ` : ''}
              {selectedDriver.full_name || selectedDriver.driver_custom_id || 'Assigned Driver'}
            </Text>

            <Text
              style={
                styles.selectedDriverDetails
              }
            >
              Driver: {selectedDriver.full_name || 'Approved Driver'}
            </Text>

            {/* Rest of payment summary remain unchanged */}
            <View
              style={
                styles.paymentSummary
              }
            >
              <View>
                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Destination
                </Text>

                <Text
                  style={
                    styles.summaryValue
                  }
                >
                  {
                    selectedDestination?.name
                  }
                </Text>
              </View>

              <View
                style={
                  styles.summaryRight
                }
              >
                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Fare
                </Text>

                <Text
                  style={
                    styles.summaryAmount
                  }
                >
                  ₦
                  {Number(
                    selectedDestination?.fare ||
                      0
                  ).toLocaleString()}
                </Text>
              </View>
            </View>

            <Pressable
              style={[
                styles.continueButton,
                purchasing &&
                  styles.disabledButton,
              ]}
              onPress={
                purchaseTicket
              }
              disabled={purchasing}
            >
              <Text
                style={
                  styles.continueButtonText
                }
              >
                {purchasing
                  ? 'Processing Payment...'
                  : `Pay ₦${Number(
                      selectedDestination?.fare ||
                        0
                    ).toLocaleString()} & Get Ticket`}
              </Text>
            </Pressable>
          </View>
        )}

        {/* QUICK ACCESS */}
        <View
          style={styles.quickAccess}
        >
          <Pressable
            style={styles.quickCard}
            onPress={() =>
              router.push('/ticket')
            }
          >
            <Text
              style={
                styles.quickTitle
              }
            >
              My Ticket
            </Text>

            <Text
              style={
                styles.quickText
              }
            >
              View your latest QR
              ticket
            </Text>
          </Pressable>

          <Pressable
            style={styles.quickCard}
            onPress={() =>
              router.push('/transactions')
            }
          >
            <Text
              style={
                styles.quickTitle
              }
            >
              Transactions
            </Text>

            <Text
              style={
                styles.quickText
              }
            >
              View wallet
              transactions
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      {/* FUNDING REQUEST MODAL */}
      <Modal
        visible={
          fundingModalVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setFundingModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View style={styles.modal}>
            <Text
              style={
                styles.modalTitle
              }
            >
              Top Up Wallet
            </Text>

            <Text
              style={
                styles.modalText
              }
            >
              Enter the amount you want to add to your wallet.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Amount e.g. 1000"
              keyboardType="numeric"
              value={fundingAmount}
              onChangeText={
                setFundingAmount
              }
            />

            <View
              style={
                styles.modalButtons
              }
            >
              <Pressable
                style={
                  styles.cancelButton
                }
                onPress={() =>
                  setFundingModalVisible(
                    false
                  )
                }
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={
                  styles.submitButton
                }
                onPress={
                  topUpWallet
                }
                disabled={
                  requestingFunding
                }
              >
                <Text
                  style={
                    styles.submitText
                  }
                >
                  {requestingFunding
                    ? 'Sending...'
                    : 'Top Up Now'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* TRANSFER FUNDS MODAL */}
      <Modal
        visible={
          transferModalVisible
        }
        transparent
        animationType="slide"
        onRequestClose={() =>
          setTransferModalVisible(
            false
          )
        }
      >
        <View
          style={
            styles.modalOverlay
          }
        >
          <View style={styles.modal}>
            <Text
              style={
                styles.modalTitle
              }
            >
              Transfer Funds
            </Text>

            <Text
              style={
                styles.modalText
              }
            >
              Send money directly from
              your wallet to another
              ABU Ride passenger.
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Passenger email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={recipientEmail}
              onChangeText={
                setRecipientEmail
              }
            />

            <TextInput
              style={styles.input}
              placeholder="Amount e.g. 200"
              keyboardType="numeric"
              value={transferAmount}
              onChangeText={
                setTransferAmount
              }
            />

            <TextInput
              style={[
                styles.input,
                styles.noteInput,
              ]}
              placeholder="Note (optional)"
              value={transferNote}
              onChangeText={
                setTransferNote
              }
              multiline
            />

            <Text
              style={
                styles.transferBalanceText
              }
            >
              Available balance: ₦
              {walletBalance.toLocaleString()}
            </Text>

            <View
              style={
                styles.modalButtons
              }
            >
              <Pressable
                style={
                  styles.cancelButton
                }
                onPress={() =>
                  setTransferModalVisible(
                    false
                  )
                }
                disabled={transferring}
              >
                <Text
                  style={
                    styles.cancelText
                  }
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.submitButton,
                  transferring &&
                    styles.disabledButton,
                ]}
                onPress={
                  transferFunds
                }
                disabled={transferring}
              >
                <Text
                  style={
                    styles.submitText
                  }
                >
                  {transferring
                    ? 'Transferring...'
                    : 'Transfer'}
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

  /* BRANDING */

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

  /* WELCOME */

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

  /* WALLET */

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

  /* SECTION */

  sectionTitle: {
    fontSize: 19,
    fontWeight: '700',
    color: '#176B45',
    marginBottom: 12,
  },

  /* DESTINATIONS */

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

  /* SELECTED DESTINATION */

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

  /* DRIVERS */

  driverHeader: {
    flexDirection: 'row',
    justifyContent:
      'space-between',
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

  /* SELECTED DRIVER */

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
    justifyContent:
      'space-between',
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

  /* QUICK ACCESS */

  quickAccess: {
    flexDirection: 'row',
    gap: 12,
  },

  quickCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#DCE7E0',
  },

  quickTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#176B45',
  },

  quickText: {
    fontSize: 12,
    color: '#6B756F',
    marginTop: 5,
    lineHeight: 18,
  },

  /* MODALS */

  modalOverlay: {
    flex: 1,
    backgroundColor:
      'rgba(0,0,0,0.45)',
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

  submitText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});