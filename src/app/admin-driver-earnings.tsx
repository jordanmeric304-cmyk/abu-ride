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
  TouchableOpacity,
  View,
} from 'react-native';

import { router } from 'expo-router';
import * as SecureStore from 'expo-secure-store';

import abuLogo from '../../assets/images/abu-logo.png';

const API_URL =
  'http://192.168.204.133:5000';

type DailyEarning = {
  date: string;
  amount: number;
};

type DriverEarning = {
  driver_id: number;
  full_name: string;
  email: string;
  phone: string | null;
  total_earnings: number;
  daily_earnings: DailyEarning[];
};

export default function AdminDriverEarningsScreen() {
  const [drivers, setDrivers] =
    useState<DriverEarning[]>([]);

  const [totalEarnings, setTotalEarnings] =
    useState(0);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  useEffect(() => {
    loadEarnings();
  }, []);

  const loadEarnings = async () => {
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
                router.replace(
                  '/login'
                ),
            },
          ]
        );

        return;
      }

      const response = await fetch(
        `${API_URL}/api/admin/driver-earnings`,
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
        throw new Error(
          data.message ||
            'Unable to load driver earnings.'
        );
      }

      setDrivers(
        data.drivers || []
      );

      setTotalEarnings(
        Number(
          data.summary
            ?.total_earnings || 0
        )
      );
    } catch (error: any) {
      console.error(
        'Driver earnings error:',
        error
      );

      Alert.alert(
        'Unable to Load Earnings',
        error.message ||
          'Could not load driver earnings.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatMoney = (
    amount: number
  ) => {
    return `₦${Number(
      amount
    ).toLocaleString()}`;
  };

  const formatDate = (
    date: string
  ) => {
    const parsedDate =
      new Date(date);

    if (
      Number.isNaN(
        parsedDate.getTime()
      )
    ) {
      return date;
    }

    return parsedDate.toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  };

  return (
    <SafeAreaView
      style={styles.container}
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() => {
              setRefreshing(true);
              loadEarnings();
            }}
            tintColor="#168447"
          />
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* HEADER */}

        <View style={styles.header}>
          <TouchableOpacity
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
            activeOpacity={0.8}
          >
            <Text
              style={
                styles.backIcon
              }
            >
              ‹
            </Text>
          </TouchableOpacity>

          <Image
            source={abuLogo}
            style={styles.logo}
            resizeMode="contain"
          />

          <View
            style={
              styles.headerTextContainer
            }
          >
            <Text
              style={
                styles.logoTitle
              }
            >
              ABU RIDE
            </Text>

            <Text
              style={
                styles.logoSubtitle
              }
            >
              Drivers Earnings
            </Text>
          </View>
        </View>

        {/* TITLE */}

        <View
          style={
            styles.titleSection
          }
        >
          <Text
            style={styles.title}
          >
            Drivers Earnings
          </Text>

        </View>

        {/* TOTAL */}

        <View
          style={
            styles.totalCard
          }
        >
          <Text
            style={
              styles.totalLabel
            }
          >
            Total Driver Earnings
          </Text>

          <Text
            style={
              styles.totalAmount
            }
          >
            {formatMoney(
              totalEarnings
            )}
          </Text>

          <Text
            style={
              styles.totalDescription
            }
          >
            Combined earnings across all drivers
          </Text>
        </View>

        {/* DRIVER SECTION */}

        <Text
          style={
            styles.sectionTitle
          }
        >
          Drivers
        </Text>

        {loading ? (
          <View
            style={styles.loading}
          >
            <ActivityIndicator
              size="large"
              color="#168447"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading earnings...
            </Text>
          </View>
        ) : drivers.length ===
          0 ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Text
              style={
                styles.emptyTitle
              }
            >
              No Drivers Found
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              There are currently no registered drivers.
            </Text>
          </View>
        ) : (
          drivers.map(
            (driver) => (
              <View
                key={
                  driver.driver_id
                }
                style={
                  styles.driverCard
                }
              >
                {/* DRIVER DETAILS */}

                <View
                  style={
                    styles.driverHeader
                  }
                >
                  <View
                    style={
                      styles.avatar
                    }
                  >
                    <Text
                      style={
                        styles.avatarText
                      }
                    >
                      {driver.full_name
                        ?.charAt(
                          0
                        )
                        .toUpperCase() ||
                        'D'}
                    </Text>
                  </View>

                  <View
                    style={
                      styles.driverIdentity
                    }
                  >
                    <Text
                      style={
                        styles.driverName
                      }
                    >
                      {
                        driver.full_name
                      }
                    </Text>

                    <Text
                      style={
                        styles.driverEmail
                      }
                    >
                      {
                        driver.email
                      }
                    </Text>

                    {driver.phone ? (
                      <Text
                        style={
                          styles.driverPhone
                        }
                      >
                        {
                          driver.phone
                        }
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* TOTAL EARNED */}

                <View
                  style={
                    styles.earningsBox
                  }
                >
                  <Text
                    style={
                      styles.earningsLabel
                    }
                  >
                    Total Earned
                  </Text>

                  <Text
                    style={
                      styles.earningsAmount
                    }
                  >
                    {formatMoney(
                      driver.total_earnings
                    )}
                  </Text>
                </View>

                {/* DAILY EARNINGS */}

                <View
                  style={
                    styles.dailySection
                  }
                >
                  <Text
                    style={
                      styles.dailyTitle
                    }
                  >
                    Daily Earnings
                  </Text>

                  {driver
                    .daily_earnings
                    .length ===
                  0 ? (
                    <View
                      style={
                        styles.noDaily
                      }
                    >
                      <Text
                        style={
                          styles.noDailyText
                        }
                      >
                        No earnings recorded yet.
                      </Text>
                    </View>
                  ) : (
                    driver.daily_earnings.map(
                      (
                        earning,
                        index
                      ) => (
                        <View
                          key={`${driver.driver_id}-${earning.date}-${index}`}
                          style={[
                            styles.dailyRow,
                            index ===
                              driver
                                .daily_earnings
                                .length -
                                1 &&
                              styles.lastDailyRow,
                          ]}
                        >
                          <Text
                            style={
                              styles.dailyDate
                            }
                          >
                            {formatDate(
                              earning.date
                            )}
                          </Text>

                          <Text
                            style={
                              styles.dailyAmount
                            }
                          >
                            {formatMoney(
                              earning.amount
                            )}
                          </Text>
                        </View>
                      )
                    )
                  )}
                </View>
              </View>
            )
          )
        )}

        {/* REFRESH */}

        <TouchableOpacity
          style={
            styles.refreshButton
          }
          onPress={
            loadEarnings
          }
          activeOpacity={0.85}
        >
          <Text
            style={
              styles.refreshText
            }
          >
            REFRESH EARNINGS
          </Text>
        </TouchableOpacity>

        <View
          style={
            styles.bottomSpace
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor:
        '#F6F8F7',
    },

    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 30,
    },

    header: {
      flexDirection:
        'row',
      alignItems:
        'center',
      marginBottom: 24,
    },

    backButton: {
      width: 42,
      height: 42,
      borderRadius: 12,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#E1E9E3',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 10,
    },

    backIcon: {
      fontSize: 31,
      lineHeight: 32,
      color: '#168447',
      marginTop: -3,
    },

    logo: {
      width: 46,
      height: 46,
      marginRight: 9,
    },

    headerTextContainer: {
      flex: 1,
    },

    logoTitle: {
      fontSize: 18,
      fontWeight: '900',
      color: '#168447',
      letterSpacing: 0.5,
    },

    logoSubtitle: {
      fontSize: 10,
      color: '#7A847E',
      marginTop: 1,
    },

    titleSection: {
      marginBottom: 18,
    },

    title: {
      fontSize: 27,
      fontWeight: '800',
      color: '#17201B',
    },

    subtitle: {
      marginTop: 4,
      fontSize: 13,
      color: '#758078',
    },

    totalCard: {
      backgroundColor:
        '#168447',
      borderRadius: 20,
      padding: 22,
      marginBottom: 25,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.08,
      shadowRadius: 9,
      elevation: 3,
    },

    totalLabel: {
      color: '#DDF2E5',
      fontSize: 13,
      fontWeight: '600',
    },

    totalAmount: {
      color: '#FFFFFF',
      fontSize: 34,
      fontWeight: '900',
      marginTop: 6,
    },

    totalDescription: {
      color: '#E7F7EC',
      fontSize: 12,
      marginTop: 5,
    },

    sectionTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#17201B',
      marginBottom: 12,
    },

    loading: {
      alignItems: 'center',
      paddingVertical: 50,
    },

    loadingText: {
      marginTop: 10,
      color: '#758078',
      fontSize: 13,
    },

    emptyCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 17,
      borderWidth: 1,
      borderColor:
        '#E1E9E3',
      padding: 28,
      alignItems:
        'center',
    },

    emptyTitle: {
      fontSize: 18,
      fontWeight: '800',
      color: '#17201B',
    },

    emptyText: {
      color: '#758078',
      fontSize: 13,
      marginTop: 6,
      textAlign:
        'center',
    },

    driverCard: {
      backgroundColor:
        '#FFFFFF',
      borderRadius: 18,
      borderWidth: 1,
      borderColor:
        '#E1E9E3',
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

    driverHeader: {
      flexDirection:
        'row',
      alignItems:
        'center',
    },

    avatar: {
      width: 50,
      height: 50,
      borderRadius: 25,
      backgroundColor:
        '#E4F3EA',
      borderWidth: 1,
      borderColor:
        '#C4E5CF',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginRight: 12,
    },

    avatarText: {
      color: '#168447',
      fontSize: 19,
      fontWeight: '800',
    },

    driverIdentity: {
      flex: 1,
    },

    driverName: {
      fontSize: 16,
      fontWeight: '800',
      color: '#17201B',
    },

    driverEmail: {
      fontSize: 12,
      color: '#68736D',
      marginTop: 3,
    },

    driverPhone: {
      fontSize: 12,
      color: '#68736D',
      marginTop: 2,
    },

    earningsBox: {
      backgroundColor:
        '#F0F7F2',
      borderRadius: 13,
      padding: 14,
      marginTop: 15,
      borderWidth: 1,
      borderColor:
        '#DCEBDF',
    },

    earningsLabel: {
      color: '#68736D',
      fontSize: 11,
      fontWeight: '600',
    },

    earningsAmount: {
      color: '#168447',
      fontSize: 24,
      fontWeight: '900',
      marginTop: 3,
    },

    dailySection: {
      marginTop: 17,
    },

    dailyTitle: {
      fontSize: 14,
      fontWeight: '800',
      color: '#17201B',
      marginBottom: 8,
    },

    dailyRow: {
      flexDirection:
        'row',
      justifyContent:
        'space-between',
      alignItems:
        'center',
      paddingVertical: 11,
      borderBottomWidth: 1,
      borderBottomColor:
        '#EDF1EE',
    },

    lastDailyRow: {
      borderBottomWidth: 0,
    },

    dailyDate: {
      color: '#68736D',
      fontSize: 13,
    },

    dailyAmount: {
      color: '#168447',
      fontSize: 14,
      fontWeight: '800',
    },

    noDaily: {
      backgroundColor:
        '#F7F9F8',
      borderRadius: 10,
      padding: 12,
    },

    noDailyText: {
      color: '#7A847E',
      fontSize: 12,
    },

    refreshButton: {
      height: 50,
      borderRadius: 13,
      backgroundColor:
        '#FFFFFF',
      borderWidth: 1,
      borderColor:
        '#D6E3D9',
      alignItems:
        'center',
      justifyContent:
        'center',
      marginTop: 5,
    },

    refreshText: {
      color: '#168447',
      fontSize: 13,
      fontWeight: '800',
    },

    bottomSpace: {
      height: 20,
    },
  });