import { router, useFocusEffect } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

const API_URL = 'https://abu-ride.onrender.com';

type Transaction = {
  id: number;
  transaction_reference: string;
  type: string;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  description: string | null;
  status: string;
  ticket_id: number | null;
  ticket_reference: string | null;
  destination_name: string | null;
};

export default function TransactionsScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = async () => {
    try {
      const token =
        await SecureStore.getItemAsync('auth_token');

      if (!token) {
        Alert.alert(
          'Session expired',
          'Please log in again.'
        );

        router.replace('/login');
        return;
      }

      const response = await fetch(
        `${API_URL}/api/wallet/transactions`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        Alert.alert(
          'Unable to load transactions',
          data.message ||
            'Something went wrong while loading your transactions.'
        );

        return;
      }

      setTransactions(
        data.transactions || []
      );
    } catch (error) {
      console.log(
        'Transactions error:',
        error
      );

      Alert.alert(
        'Connection Error',
        'Unable to connect to the ABU Ride server.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadTransactions();
    }, [])
  );

  const refreshTransactions = () => {
    setRefreshing(true);
    loadTransactions();
  };

  const getTransactionTitle = (
    transaction: Transaction
  ) => {
    switch (transaction.type) {
      case 'wallet_funding':
        return 'Wallet Funding';

      case 'ticket_purchase':
        return 'Ticket Purchase';

      case 'transfer_sent':
        return 'Transfer Sent';

      case 'transfer_received':
        return 'Transfer Received';

      case 'refund':
        return 'Refund';

      case 'driver_earning':
        return 'Driver Earnings';

      default:
        return 'Transaction';
    }
  };

  const getTransactionSubtitle = (
    transaction: Transaction
  ) => {
    if (transaction.type === 'ticket_purchase') {
      if (transaction.destination_name) {
        return `Bus fare to ${transaction.destination_name}`;
      }

      return 'Bus fare ticket purchase';
    }

    if (transaction.description) {
      return transaction.description;
    }

    return transaction.transaction_reference;
  };

  const isCredit = (
    transaction: Transaction
  ) => {
    return (
      transaction.type === 'wallet_funding' ||
      transaction.type === 'transfer_received' ||
      transaction.type === 'refund' ||
      transaction.type === 'driver_earning'
    );
  };

  const getStatusStyle = (
    status: string
  ) => {
    switch (status) {
      case 'successful':
        return styles.successStatus;

      case 'pending':
        return styles.pendingStatus;

      case 'failed':
      case 'reversed':
        return styles.failedStatus;

      default:
        return styles.pendingStatus;
    }
  };

  const getStatusTextStyle = (
    status: string
  ) => {
    switch (status) {
      case 'successful':
        return styles.successStatusText;

      case 'pending':
        return styles.pendingStatusText;

      case 'failed':
      case 'reversed':
        return styles.failedStatusText;

      default:
        return styles.pendingStatusText;
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={
          styles.scrollContent
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshTransactions}
          />
        }
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.backButton}
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              ‹
            </Text>
          </Pressable>

          <View style={styles.headerText}>
            <Text
              style={styles.headerTitle}
            >
              Transactions
            </Text>

            <Text
              style={styles.headerSubtitle}
            >
              Your wallet activity
            </Text>
          </View>
        </View>

        {/* SUMMARY */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>
            Total Records
          </Text>

          <Text style={styles.summaryAmount}>
            {transactions.length}
          </Text>

          <Text style={styles.summaryDescription}>
            Wallet transactions recorded on your account
          </Text>
        </View>

        {/* TRANSACTIONS */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Transaction History
          </Text>

          {transactions.length > 0 && (
            <Text style={styles.recordCount}>
              {transactions.length} records
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.emptyBox}>
            <ActivityIndicator
              size="small"
              color="#176B45"
            />

            <Text style={styles.emptyTitle}>
              Loading transactions...
            </Text>
          </View>
        ) : transactions.length === 0 ? (
          <View style={styles.emptyBox}>
            <View style={styles.emptyIcon}>
              <Text style={styles.emptyIconText}>
                ₦
              </Text>
            </View>

            <Text style={styles.emptyTitle}>
              No transactions yet
            </Text>

            <Text style={styles.emptyText}>
              Your wallet transactions will
              appear here after you fund your
              wallet, purchase a ticket or
              transfer funds.
            </Text>
          </View>
        ) : (
          transactions.map(
            (transaction) => {
              const credit =
                isCredit(transaction);

              return (
                <View
                  key={transaction.id}
                  style={
                    styles.transactionCard
                  }
                >
                  <View
                    style={
                      styles.transactionTop
                    }
                  >
                    <View
                      style={[
                        styles.transactionIcon,
                        credit
                          ? styles.creditIcon
                          : styles.debitIcon,
                      ]}
                    >
                      <Text
                        style={[
                          styles.transactionIconText,
                          credit
                            ? styles.creditIconText
                            : styles.debitIconText,
                        ]}
                      >
                        {credit
                          ? '+'
                          : '−'}
                      </Text>
                    </View>

                    <View
                      style={
                        styles.transactionInfo
                      }
                    >
                      <Text
                        style={
                          styles.transactionTitle
                        }
                      >
                        {getTransactionTitle(
                          transaction
                        )}
                      </Text>

                      <Text
                        style={
                          styles.transactionDescription
                        }
                      >
                        {getTransactionSubtitle(
                          transaction
                        )}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.transactionAmount,
                        credit
                          ? styles.creditAmount
                          : styles.debitAmount,
                      ]}
                    >
                      {credit ? '+' : '−'}₦
                      {Number(
                        transaction.amount
                      ).toLocaleString()}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.transactionDivider
                    }
                  />

                  <View
                    style={
                      styles.transactionBottom
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.referenceLabel
                        }
                      >
                        Reference
                      </Text>

                      <Text
                        style={
                          styles.referenceText
                        }
                      >
                        {
                          transaction.transaction_reference
                        }
                      </Text>
                    </View>

                    <View
                      style={
                        styles.transactionRight
                      }
                    >
                      <View
                        style={[
                          styles.statusBadge,
                          getStatusStyle(
                            transaction.status
                          ),
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            getStatusTextStyle(
                              transaction.status
                            ),
                          ]}
                        >
                          {transaction.status
                            .charAt(0)
                            .toUpperCase() +
                            transaction.status.slice(
                              1
                            )}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {transaction.type ===
                    'ticket_purchase' &&
                    transaction.ticket_reference && (
                      <View
                        style={
                          styles.ticketReferenceBox
                        }
                      >
                        <Text
                          style={
                            styles.ticketReferenceLabel
                          }
                        >
                          Ticket Reference
                        </Text>

                        <Text
                          style={
                            styles.ticketReference
                          }
                        >
                          {
                            transaction.ticket_reference
                          }
                        </Text>
                      </View>
                    )}
                </View>
              );
            }
          )
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6F9F7',
  },

  scrollContent: {
    padding: 20,
    paddingBottom: 50,
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 22,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#E8F5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  backButtonText: {
    fontSize: 30,
    lineHeight: 32,
    color: '#176B45',
    marginTop: -3,
  },

  headerText: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#17211B',
  },

  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 3,
  },

  summaryCard: {
    backgroundColor: '#176B45',
    borderRadius: 20,
    padding: 22,
    marginBottom: 26,
  },

  summaryLabel: {
    color: '#DCEFE5',
    fontSize: 13,
    fontWeight: '600',
  },

  summaryAmount: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '800',
    marginTop: 5,
  },

  summaryDescription: {
    color: '#DCEFE5',
    fontSize: 12,
    marginTop: 5,
    lineHeight: 18,
  },

  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },

  sectionTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#17211B',
  },

  recordCount: {
    fontSize: 12,
    color: '#6B7280',
  },

  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 17,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E1E9E4',
  },

  transactionTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  transactionIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },

  creditIcon: {
    backgroundColor: '#E8F5EE',
  },

  debitIcon: {
    backgroundColor: '#FFF1F0',
  },

  transactionIconText: {
    fontSize: 23,
    fontWeight: '800',
  },

  creditIconText: {
    color: '#176B45',
  },

  debitIconText: {
    color: '#C0392B',
  },

  transactionInfo: {
    flex: 1,
    paddingRight: 8,
  },

  transactionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#17211B',
  },

  transactionDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    lineHeight: 17,
  },

  transactionAmount: {
    fontSize: 15,
    fontWeight: '800',
  },

  creditAmount: {
    color: '#176B45',
  },

  debitAmount: {
    color: '#C0392B',
  },

  transactionDivider: {
    height: 1,
    backgroundColor: '#EDF1EE',
    marginVertical: 14,
  },

  transactionBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  referenceLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    marginBottom: 3,
  },

  referenceText: {
    fontSize: 11,
    color: '#52605A',
    fontWeight: '600',
  },

  transactionRight: {
    alignItems: 'flex-end',
  },

  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },

  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },

  successStatus: {
    backgroundColor: '#E8F5EE',
  },

  successStatusText: {
    color: '#176B45',
  },

  pendingStatus: {
    backgroundColor: '#FFF7E6',
  },

  pendingStatusText: {
    color: '#A66A00',
  },

  failedStatus: {
    backgroundColor: '#FFF1F0',
  },

  failedStatusText: {
    color: '#C0392B',
  },

  ticketReferenceBox: {
    backgroundColor: '#F3FAF6',
    borderRadius: 10,
    padding: 10,
    marginTop: 12,
  },

  ticketReferenceLabel: {
    fontSize: 10,
    color: '#6B7280',
    marginBottom: 3,
  },

  ticketReference: {
    fontSize: 12,
    color: '#176B45',
    fontWeight: '700',
  },

  emptyBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 30,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E1E9E4',
  },

  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: '#E8F5EE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },

  emptyIconText: {
    color: '#176B45',
    fontSize: 25,
    fontWeight: '800',
  },

  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#17211B',
    marginBottom: 7,
  },

  emptyText: {
    fontSize: 13,
    color: '#6B7280',
    lineHeight: 20,
    textAlign: 'center',
  },
});