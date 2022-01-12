import React from 'react';
import { SafeAreaView, StyleSheet, Clipboard, Image, View, TouchableWithoutFeedback } from 'react-native';
import * as eva from '@eva-design/eva';
import { ApplicationProvider, IconRegistry, Layout, Text, Button, Icon, TopNavigation, Divider,
  Autocomplete, AutocompleteItem } from '@ui-kitten/components';
import DateTimePicker from '@react-native-community/datetimepicker';
import CheckBox from '@react-native-community/checkbox'; //the checkbox from ui kitten doesn't seem to work in windows
import Toast from 'react-native-toast-message';
import { default as theme } from './theme.json'; //custom UI Kitten theme
import { FeatherIconsPack } from './feather-icons';
import { CoinGeckoClient } from './CoinGeckoClient';
//import Clipboard from '@react-native-clipboard/clipboard'; <-- this doesn't seem to work (in windows at least) - using the deprecated one from react-native instead (https://github.com/react-native-clipboard/clipboard/issues/71)

const CopyIcon = (props) => (
  <Icon name='copy' {...props} />
);

const CloseIcon = (props) => (
  <Icon name='x' {...props} />
);

const CalendarIcon = (props) => (
  <Icon name='calendar' {...props} />
);

const sampleAssets = [
  { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
  { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
  { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
  { id: 'binancecoin', name: 'Binance Coin', symbol: 'BNB' },
  { id: 'tether', name: 'Tether', symbol: 'USDT' },
  { id: 'ripple', name: 'XRP', symbol: 'XRP' },
  { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
  { id: 'solana', name: 'Solana', symbol: 'SOL' },
  { id: 'usd-coin', name: 'USD Coin', symbol: 'USDC' },
  { id: 'polkadot', name: 'Polkadot', symbol: 'DOT' },
];

const filterAssets = (item, query) => getAssetDesc(item).toLowerCase().includes(query.toLowerCase());

const getAssetDesc = (asset) => {
  return `${asset.name} (${asset.symbol})`;
}

const renderAssetOption = (item, index) => (
  <AutocompleteItem
    key={item.id}
    title={getAssetDesc(item)}
  />
);

const coinGeckoClient = new CoinGeckoClient();
const coinGecko_PAGE_SIZE = 250; //valid values: 1..250

//main React function
const App = () => {
  const [date, setDate] = React.useState(null); //new Date(1231459200000) = 2009/01/09
  const [statusText, setStatusText] = React.useState(null);
  const [loadAllCoins, setLoadAllCoins] = React.useState(false);
  const [selectedAsset, setSelectedAsset] = React.useState(null);
  const [selectedAssetData, setSelectedAssetData] = React.useState(null);
  const [autoCompleteText, setAutoCompleteText] = React.useState('');
  const [allAssets, setAllAssets] = React.useState(sampleAssets);
  const [filteredAssets, setFilteredAssets] = React.useState(allAssets);

  //action on update of allAssets
  React.useEffect(() => {    
    resetAssetInput();
  }, [allAssets]);

  //action when price needs to be queried from API (on change of selected asset or date)
  React.useEffect(() => {
    if (selectedAsset && date) {
      setSelectedAssetData(null);

      coinGeckoClient.coinHistory(selectedAsset.id, date).then(data => {
        setSelectedAssetData({
          PriceUSD: data.market_data?.current_price?.usd,
          Image: data.image?.thumb
        });
      })
    }
  }, [date, selectedAsset]);

  //initialize with data from API
  React.useEffect(() => {
    console.log(`calling CoinGecko`);
    coinGeckoClient.ping()
      .then(data => console.log(`ping: ${JSON.stringify(data)}`));

    getTopCoins();

  }, []); //pass empty array as second parameter to useEffect to only have it run once

  //action when user changes Load All Coins checkbox
  React.useEffect(() => {
    if (loadAllCoins) {
      getAllCoins();
    } else {
      getTopCoins();
    }
  }, [loadAllCoins]);

  const getTopCoins = () => {
    setStatusText('...loading coins');

    coinGeckoClient.coinsMarkets('usd', coinGecko_PAGE_SIZE, 1).then(data => {
      console.log(`coinsMarkets data received: ${data.length} coins`);

      const assets = [];
      for (const coin of data) {
        assets.push({ id: coin.id, name: coin.name, symbol: coin.symbol.toUpperCase() });
      }
      setStatusText(`Showing top ${assets.length} coins based on market cap`);
      setAllAssets(assets);
      //we can't just call resetAssetInput() here, because the update to allAssets does not happen immediately:
      //that's why we have instead hooked up the useEffect for allAssets, which runs after it has been updated
      //https://stackoverflow.com/a/54069332
    });
  }

  const getAllCoins = () => {
    setStatusText('...loading all coins');

    //The /coins/list method gets all the coins (9000+) not sorted by market cap
    //To get it sorted by market cap, you can use the /coins/markets method and get all of the pages, as done in getAllCoinsByMarketCap() but which can be a lot slower
    coinGeckoClient.coinsList().then(data => {
      console.log(`coinsList data received: ${data.length} coins`);

      const assets = [];
      for (const coin of data) {
        assets.push({id: coin.id, name: coin.name, symbol: coin.symbol.toUpperCase()});
      }
      setStatusText(`Showing all ${assets.length} coins in no particular order`);
      setAllAssets(assets);
    });
  }

  const getAllCoinsByMarketCap_buggy = async () => {
    let progressText = 'loading all coins ...'
    setStatusText(progressText);

    const assets = [];
    const assetsAdded = {};
    let page = 1, resultLength = 0;
    const pageSize = coinGecko_PAGE_SIZE;

    while (page == 1 || resultLength >= pageSize) { //continue while there is more pages
      let data = await coinGeckoClient.coinsMarkets('usd', pageSize, page);
      resultLength = data.length;
      console.log(`coinsMarkets data received: page ${page} = ${data.length} coins`);

      for (const coin of data) {
        if (!assetsAdded[coin.id]) {
          assets.push({ id: coin.id, name: coin.name, symbol: coin.symbol.toUpperCase() });
          assetsAdded[coin.id] = true;
        } else {
          //BUG
          //there is some sort of bug somewhere where it will return the same coins for different pages
          //not sure how to handle this from here, might need to do a wait and retry or something, it could also be that the order of the underlying CoinGecko market data changed while we were busy querying the pages ...
          console.log(`!! page ${page}: coin with id ${coin.id} already added`);
        }
      }

      progressText += '.';
      setStatusText(progressText);
      page++;
    }

    setStatusText(`Showing ${assets.length} coins sorted by market cap`);
    setAllAssets(assets);
  }

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || date;
    setDate(currentDate);
    console.log(`new date: ${currentDate}`); //TEST
  };

  const resetAssetInput = () => {
    console.log('resetAssetInput'); //TEST
    setAutoCompleteText('');
    setSelectedAsset(null);
    setSelectedAssetData(null);
    setFilteredAssets(allAssets);
  };

  const onAssetSelect = (index) => {
    console.log('onAssetSelect'); //TEST
    setAutoCompleteText(getAssetDesc(filteredAssets[index]));
    setSelectedAsset(filteredAssets[index]);
    console.log(`new asset: ${getAssetDesc(filteredAssets[index])}`); //TEST
  };

  const onAssetChangeText = (query) => {
    console.log('onAssetChangeText'); //TEST
    setAutoCompleteText(query);

    let newFilterAssets = allAssets.filter(item => filterAssets(item, query));
    if (newFilterAssets.length == 1) {
      setSelectedAsset(newFilterAssets[0]);
    } else {
      setSelectedAsset(null);
    }
    setFilteredAssets(newFilterAssets);
  };

  const setToTodaysDate = () => {
    let today = new Date();
    today.setHours(0,0,0,0);
    setDate(today);
  };

  const copyPrice = () => {
    if (!selectedAsset) {
      Clipboard.setString('(no asset selected)');
      return;
    }
    
    if (!date){
      Clipboard.setString('(no date specified)');
      return;
    }

    Clipboard.setString(selectedAssetData?.PriceUSD);
  
    Toast.show({
      type: 'success', position: 'top',
      visibilityTime: 1500, autoHide: true,
      text1: 'price copied'
    });
  };

  const formatPriceUSD = () => {
    return `$${selectedAssetData ? parseFloat(selectedAssetData.PriceUSD).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") : '----.--'}`;
  }

  const RenderPrice = () => (
    <>
      <Text category='p2'>{date ? `snapshot on ${date.toDateString()}:` : ''}</Text>

      <Layout style={styles.rowContainer}>
        {(selectedAsset && selectedAssetData) && <Image 
          style={styles.thumbImage}
          source={{ uri: selectedAssetData.Image }}
        />}
        <Text category='p1'>{selectedAsset ? ` 1 ${selectedAsset.symbol} = ${formatPriceUSD()}` : '(please select asset)'}</Text>
      </Layout>
    </>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      {/* <TopNavigation title='Data provided by CoinGecko' alignment='center'/> */}
      <Layout style={styles.verticalLayout}>
        {/* <Text category='s1' status='info'>Data provided by CoinGecko</Text> */}

        <Layout style={styles.rowContainer}>
          <Text category='s1' status='info'>Data provided by </Text>
          <Image style={styles.logoImage} source={ require('./assets/CoinGecko.png') } />
        </Layout>

        <Text category='p2' alignment='center'>{statusText}</Text>
        
        <Layout style={styles.rowContainer}>
          <CheckBox
            value={loadAllCoins}
            onValueChange={(newValue) => setLoadAllCoins(newValue)}>
          </CheckBox>
          <Text category='p2'>Load All Coins</Text>
        </Layout>
      </Layout>

      <Divider/>
      <Layout style={styles.verticalLayout}>
        <Text category='h6'>Select Asset</Text>
        <Autocomplete
          style={styles.assetAutocomplete}
          placeholder='Select or type asset name'
          value={autoCompleteText}
          onChangeText={onAssetChangeText}
          onSelect={onAssetSelect}>
            {filteredAssets.map(renderAssetOption)}
        </Autocomplete>
        <Button style={styles.btn} accessoryLeft={CloseIcon} onPress={resetAssetInput}>Clear Selection</Button>
      </Layout>

      <Divider/>
      <Layout style={styles.verticalLayout}>
        <Text category='h6'>Select Date</Text>
        <DateTimePicker
          dateFormat="{year.full}/{month.integer(2)}‎/‎{day.integer(2)}‎"
          testID="dateTimePicker"
          value={date}
          mode="date"
          is24Hour={true}
          display="inline"
          onChange={onDateChange}
        />
        <Button style={styles.btn} accessoryLeft={CalendarIcon} onPress={setToTodaysDate}>Today</Button> 
      </Layout>

      <Divider/>
      <Layout style={styles.verticalLayout}>
        <Text category='h6'>Price</Text>
        <RenderPrice/>
        <Button style={styles.btn} accessoryLeft={CopyIcon} onPress={copyPrice}>Copy Price</Button> 
      </Layout>

      <Toast ref={(ref) => Toast.setRef(ref)} />
    </SafeAreaView>
  );
}

//App Startup:
export default () => (
  <>
    <IconRegistry icons={FeatherIconsPack} />
    <ApplicationProvider {...eva} theme={{...eva.light, ...theme}}>
      <App />
    </ApplicationProvider>
  </>
);

//Styles
const styles = StyleSheet.create({
  assetAutocomplete: {
    width: '60%'
  },
  btn: {
    margin: 4
  },
  thumbImage: {
    width: 25,
    height: 25
  },
  logoImage: {
    width: 96,
    height: 30
  },
  verticalLayout: {
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center'
  },
  rowContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center'
  }

//TO CLEAN UP (not used currently):
  // container: {
  //   minHeight: 360,
  // },
  // rowContainer: {
  //   flexDirection: 'row',
  //   justifyContent: 'space-between',
  // },
  // picker: {
  //   flex: 1,
  //   margin: 2,
  // },
});
