import {
    useEffect,
    useState,
} from 'react';

import {
    ActivityIndicator,
    Alert,
    Image,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import abuLogo from '../../assets/images/abu-logo.png';

const API_URL =
  'https://abu-ride.onrender.com';

type FundingRequest = {
  id: number;
  request_reference: string;
  user_id: number;
  full_name: string;
  email: string;
  amount: number | string;
  note: string | null;
  status:
    | 'pending'
    | 'approved'
    | 'rejected';
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

export default function AdminFundingRequestsScreen() {
  const [requests, setRequests] =
    useState<FundingRequest[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [adminNote, setAdminNote] =
    useState('');

  useEffect(() => {
    loadRequests();
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);

      const token =
        await SecureStore.getItemAsync(
          'auth_token'
        );

      if (!token) {
        Alert.alert(
          'Login Required',
          'Please log in again.',
          [
            {
              text: 'OK',
              onPress: () =>
                router.replace('/login'),
            },
          ]
        );

        return;
      }

      const response = await fetch(
        `${API_URL}/api/admin/funding-requests`,
        {
          method: 'GET',
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        Alert.alert(
          'Unable to Load Requests',
          data.message ||
            'Could not load funding requests.'
        );

        return;
      }

      setRequests(
        data.requests || []
      );
    } catch (error) {
      console.error(
        'Admin requests error:',
        error
      );

      Alert.alert(
        'Connection Error',
        'Could not connect to the ABU Ride server.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const approveRequest = async (
    request: FundingRequest
  ) => {
    Alert.alert(
      'Approve Funding',
      `Add ₦${Number(
        request.amount
      ).toLocaleString()} to ${request.full_name}'s wallet?`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'APPROVE',
          onPress: async () => {
            try {
              setProcessingId(
                request.id
              );

              const token =
                await SecureStore.getItemAsync(
                  'auth_token'
                );

              if (!token) {
                Alert.alert(
                  'Login Required',
                  'Please log in again.'
                );

                return;
              }

              const response =
                await fetch(
                  `${API_URL}/api/admin/funding-requests/${request.id}/approve`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type':
                        'application/json',
                      Authorization:
                        `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      admin_note:
                        adminNote.trim() ||
                        null,
                    }),
                  }
                );

              const data =
                await response.json();

              if (
                !response.ok ||
                !data.success
              ) {
                Alert.alert(
                  'Approval Failed',
                  data.message ||
                    'Unable to approve request.'
                );

                return;
              }

              setAdminNote('');

              Alert.alert(
                'Funding Approved',
                `₦${Number(
                  data.wallet
                    .amount_added
                ).toLocaleString()} has been added to ${request.full_name}'s wallet.\n\nNew balance: ₦${Number(
                  data.wallet
                    .balance_after
                ).toLocaleString()}`
              );

              await loadRequests();
            } catch (error) {
              console.error(
                'Approve request error:',
                error
              );

              Alert.alert(
                'Connection Error',
                'Could not connect to the ABU Ride server.'
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const rejectRequest = async (
    request: FundingRequest
  ) => {
    Alert.alert(
      'Reject Funding',
      `Reject ${request.full_name}'s ₦${Number(
        request.amount
      ).toLocaleString()} funding request?`,
      [
        {
          text: 'CANCEL',
          style: 'cancel',
        },
        {
          text: 'REJECT',
          style: 'destructive',
          onPress: async () => {
            try {
              setProcessingId(
                request.id
              );

              const token =
                await SecureStore.getItemAsync(
                  'auth_token'
                );

              if (!token) {
                Alert.alert(
                  'Login Required',
                  'Please log in again.'
                );

                return;
              }

              const response =
                await fetch(
                  `${API_URL}/api/admin/funding-requests/${request.id}/reject`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type':
                        'application/json',
                      Authorization:
                        `Bearer ${token}`,
                    },
                    body: JSON.stringify({
                      admin_note:
                        adminNote.trim() ||
                        null,
                    }),
                  }
                );

              const data =
                await response.json();

              if (
                !response.ok ||
                !data.success
              ) {
                Alert.alert(
                  'Rejection Failed',
                  data.message ||
                    'Unable to reject request.'
                );

                return;
              }

              setAdminNote('');

              Alert.alert(
                'Request Rejected',
                'The funding request has been rejected.'
              );

              await loadRequests();
            } catch (error) {
              console.error(
                'Reject request error:',
                error
              );

              Alert.alert(
                'Connection Error',
                'Could not connect to the ABU Ride server.'
              );
            } finally {
              setProcessingId(null);
            }
          },
        },
      ]
    );
  };

  const pendingRequests =
    requests.filter(
      (request) =>
        request.status === 'pending'
    );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadRequests();
            }}
            tintColor="#168447"
          />
        }
        contentContainerStyle={styles.content}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() =>
              router.back()
            }
            activeOpacity={0.8}
          >
            <Text style={styles.backArrow}>
              ‹
            </Text>
          </TouchableOpacity>

          <Image
            source={abuLogo}
            style={styles.logo}
            resizeMode="contain"
          />

          <View style={styles.headerText}>
            <Text style={styles.logoTitle}>
              ABU RIDE
            </Text>

            <Text style={styles.logoSubtitle}>
              Funding Requests
            </Text>
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryContent}>
            <Text style={styles.summaryLabel}>
              Pending Requests
            </Text>

            <Text style={styles.summaryNumber}>
              {pendingRequests.length}
            </Text>
       </View>

          <View style={styles.summaryIcon}>
            <Text style={styles.summaryIconText}>
              ₦
            </Text>
          </View>
        </View>

        {/* PAGE TITLE */}
        <Text style={styles.sectionTitle}>
          Wallet Funding Requests
        </Text>

        {/* LOADING */}
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color="#168447"
            />

            <Text style={styles.loadingText}>
              Loading requests...
            </Text>
          </View>
        ) : requests.length === 0 ? (
          /* EMPTY */
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                ✓
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No Funding Requests
            </Text>

            <Text style={styles.emptyText}>
              There are currently no wallet funding requests.
            </Text>
          </View>
        ) : (
          /* REQUESTS */
          requests.map((request) => (
            <View
              key={request.id}
              style={styles.requestCard}
            >
              {/* USER */}
              <View style={styles.requestTop}>
                <View style={styles.requestUser}>
                  <Text style={styles.requestName}>
                    {request.full_name}
                  </Text>

                  <Text style={styles.requestEmail}>
                    {request.email}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statusBadge,
                    request.status ===
                      'approved' &&
                      styles.approvedBadge,
                    request.status ===
                      'rejected' &&
                      styles.rejectedBadge,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {request.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              {/* AMOUNT */}
              <View style={styles.amountBox}>
                <Text style={styles.amountLabel}>
                  Requested Amount
                </Text>

                <Text style={styles.amount}>
                  ₦
                  {Number(
                    request.amount
                  ).toLocaleString()}
                </Text>
              </View>

              {/* REFERENCE */}
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>
                  Reference
                </Text>

                <Text style={styles.infoValue}>
                  {request.request_reference}
                </Text>
              </View>

              {/* PASSENGER NOTE */}
              {request.note && (
                <View style={styles.noteBox}>
                  <Text style={styles.noteLabel}>
                    Passenger Note
                  </Text>

                  <Text style={styles.noteText}>
                    {request.note}
                  </Text>
                </View>
              )}

              {/* ADMIN ACTIONS */}
              {request.status ===
                'pending' && (
                <>
                  <Text style={styles.adminLabel}>
                    Admin Note
                  </Text>

                  <TextInput
                    style={styles.adminInput}
                    placeholder="Optional note..."
                    placeholderTextColor="#8A938E"
                    value={adminNote}
                    onChangeText={
                      setAdminNote
                    }
                  />

                  <View style={styles.actionRow}>
                    {/* REJECT */}
                    <TouchableOpacity
                      style={[
                        styles.rejectButton,
                        processingId ===
                          request.id &&
                          styles.disabledButton,
                      ]}
                      disabled={
                        processingId ===
                        request.id
                      }
                      onPress={() =>
                        rejectRequest(
                          request
                        )
                      }
                      activeOpacity={0.85}
                    >
                      <Text style={styles.rejectText}>
                        REJECT
                      </Text>
                    </TouchableOpacity>

                    {/* APPROVE */}
                    <TouchableOpacity
                      style={[
                        styles.approveButton,
                        processingId ===
                          request.id &&
                          styles.disabledButton,
                      ]}
                      disabled={
                        processingId ===
                        request.id
                      }
                      onPress={() =>
                        approveRequest(
                          request
                        )
                      }
                      activeOpacity={0.85}
                    >
                      {processingId ===
                      request.id ? (
                        <ActivityIndicator
                          color="#FFFFFF"
                        />
                      ) : (
                        <Text
                          style={
                            styles.approveText
                          }
                        >
                          APPROVE
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              )}
            </View>
          ))
        )}

        {/* REFRESH */}
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadRequests}
          activeOpacity={0.85}
        >
          <Text style={styles.refreshText}>
            REFRESH REQUESTS
          </Text>
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F8F7',
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 35,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },

  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DCE8DF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },

  backArrow: {
    color: '#168447',
    fontSize: 30,
    lineHeight: 32,
    marginTop: -3,
  },

  logo: {
    width: 48,
    height: 48,
    marginRight: 10,
  },

  headerText: {
    flex: 1,
  },

  logoTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#168447',
    letterSpacing: 0.6,
  },

  logoSubtitle: {
    fontSize: 11,
    color: '#758078',
    marginTop: 2,
  },

  summaryCard: {
    backgroundColor: '#168447',
    borderRadius: 20,
    padding: 21,
    marginBottom: 26,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 9,
    elevation: 3,
  },

  summaryContent: {
    flex: 1,
  },

  summaryLabel: {
    color: '#DDF2E5',
    fontSize: 13,
    fontWeight: '600',
  },

  summaryNumber: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: '900',
    marginTop: 3,
  },

  summaryText: {
    color: '#E7F7EC',
    fontSize: 12,
    marginTop: 1,
  },

  summaryIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  summaryIconText: {
    color: '#168447',
    fontSize: 25,
    fontWeight: '900',
  },

  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#17201B',
    marginBottom: 12,
  },

  loading: {
    alignItems: 'center',
    paddingVertical: 45,
  },

  loadingText: {
    marginTop: 10,
    color: '#758078',
    fontSize: 13,
  },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E9E3',
    padding: 28,
    alignItems: 'center',
    marginBottom: 18,
  },

  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#E4F3EA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },

  emptyIconText: {
    color: '#168447',
    fontSize: 23,
    fontWeight: '900',
  },

  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#17201B',
  },

  emptyText: {
    color: '#758078',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 19,
  },

  requestCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E1E9E3',
    padding: 17,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.04,
    shadowRadius: 7,
    elevation: 1,
  },

  requestTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  requestUser: {
    flex: 1,
    paddingRight: 10,
  },

  requestName: {
    fontSize: 17,
    fontWeight: '800',
    color: '#17201B',
  },

  requestEmail: {
    fontSize: 12,
    color: '#68736D',
    marginTop: 4,
  },

  statusBadge: {
    backgroundColor: '#FFF4D6',
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 20,
  },

  approvedBadge: {
    backgroundColor: '#E5F5EA',
  },

  rejectedBadge: {
    backgroundColor: '#FDEBEC',
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#68736D',
  },

  amountBox: {
    backgroundColor: '#F0F7F2',
    borderRadius: 13,
    padding: 14,
    marginTop: 15,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DCEBDF',
  },

  amountLabel: {
    color: '#68736D',
    fontSize: 11,
    fontWeight: '600',
  },

  amount: {
    color: '#168447',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 3,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
  },

  infoLabel: {
    color: '#7A847E',
    fontSize: 12,
  },

  infoValue: {
    color: '#344039',
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '65%',
    textAlign: 'right',
  },

  noteBox: {
    backgroundColor: '#F7F9F8',
    borderRadius: 11,
    padding: 12,
    marginTop: 3,
    marginBottom: 12,
  },

  noteLabel: {
    color: '#68736D',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },

  noteText: {
    color: '#344039',
    fontSize: 13,
    lineHeight: 18,
  },

  adminLabel: {
    color: '#68736D',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
  },

  adminInput: {
    borderWidth: 1,
    borderColor: '#D7E2DA',
    borderRadius: 11,
    paddingHorizontal: 12,
    paddingVertical: 11,
    color: '#17201B',
    backgroundColor: '#FBFCFB',
    marginBottom: 12,
    fontSize: 13,
  },

  actionRow: {
    flexDirection: 'row',
    gap: 10,
  },

  rejectButton: {
    flex: 1,
    height: 48,
    borderWidth: 1,
    borderColor: '#D56A6A',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },

  rejectText: {
    color: '#B53B3B',
    fontSize: 12,
    fontWeight: '800',
  },

  approveButton: {
    flex: 1,
    height: 48,
    backgroundColor: '#168447',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },

  approveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },

  disabledButton: {
    opacity: 0.5,
  },

  refreshButton: {
    height: 50,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D6E3D9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 5,
  },

  refreshText: {
    color: '#168447',
    fontSize: 12,
    fontWeight: '800',
  },

  bottomSpace: {
    height: 20,
  },
});