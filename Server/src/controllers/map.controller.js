const ee = require('@google/earthengine');
const talhoes = require('../models/talhoes.model');
const ndvi = require('../controllers/ndvi.controller')

function eeEvaluate(eeObject) {
    return new Promise((resolve, reject) => {
      eeObject.evaluate((result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
}

const validaMap = (req, res, next) => {
    if(req.body.data == '' || req.body.filtro == '') {
        res.status(406).json({message: 'Escolha uma data e um filtro antes de fazer a requisição.'})
    }
    else if( new Date(req.body.data) > new Date ){
        res.status(406).json({message: 'Data inválida.'})
    }
    else { 
        next() 
    }
}

const calcNDVI = async (fil, customPalette) => {
    const NDVI = fil.expression(
        '(nir - red) / (nir + red)',
        {
            'nir': fil.select('B8'), // NIR band
            'red': fil.select('B4') // Red  band
        }
    );

    return new Promise((resolve, reject) => {
        NDVI.getMap({min: 0, max: 0.8, palette: customPalette}, (mapInfo) => {
            resolve( mapInfo.mapid );
        });
    })
}

const calcNDRE = async (fil, customPalette) => {
    const NDRE = fil.expression(
        '(nir - rededge) / (nir + rededge)',
        {
            'nir': fil.select('B8'), // NIR band
            'rededge': fil.select('B5') // Red Edge band
        }
    );

    return new Promise((resolve, reject) => {
        NDRE.getMap({min: 0, max: 0.8, palette: customPalette}, (mapInfo) => {
            resolve( mapInfo.mapid );
        });
    })
}

const calcRGB = async (fil) => {
    const RGB = fil.select(['B4', 'B3', 'B2']);

    return new Promise((resolve, reject) => {
        RGB.getMap({min: 0, max: 3000}, (mapInfo) => {
            resolve( mapInfo.mapid );
        })
    })
}

const getFreeMap = async (req, res) => {
    const dataRecebida = new Date(req.body.data);
    const dataModificada = new Date(dataRecebida);

    dataModificada.setDate(dataModificada.getDate() - 5);


    // const coordinates = [   
    //         [-54.978868290781975,-35.00022736748559],[-53.5284124687314,-34.53191076201351],[-51.98764096945524,-33.3023744661083],[-51.52554027736187,-32.191672407025955],[-48.62988542765379,-28.72229113235912],[-47.98514977097511,-26.013700290409105],[-46.527451649308205,-24.382106469443094],[-42.11914021521807,-23.194821773484666],[-39.2188810184598,-19.618327002579992],[-38.31289317458868,-15.783326448940683],[-38.360101729631424,-13.683401718137837],[-36.65065750479698,-11.113958890005504],[-34.284739941358566,-7.853377126729674],[-34.8812809959054,-4.870186289024917],[-40.01010686159134,-2.429142099808064],[-43.83275158703327,-1.952655295384381],[-47.73030202835798,-0.361855418484914],[-49.552979059517384,0.677553790590326],[-50.79316008836031,4.040799413590178],[-52.71433889865875,5.664633076013874],[-56.08516316860914,6.10777155967496],[-60.22576466202735,11.413896417633229],[-72.95968506485224,12.18147240986471],[-78.12753103673458,9.555645877430253],[-81.1343426629901,0.192963116172253],[-81.05972193181515,-8.48900650826313],[-76.04839827865362,-14.854561300989197],[-70.34575402736664,-18.540383289662916],[-70.7258827239275,-24.04025606444402],[-71.80330261588097,-30.3522519196874],[-72.72391386330128,-35.727346918126365],[-73.79455950111151,-40.56943587413979],[-75.37012327462435,-46.139566504780326],[-75.98058130592108,-50.864784289144374],[-74.16480425745249,-53.683751141614366],[-71.45096596330404,-55.29640829695503],[-68.7139131501317,-56.03193792402649],[-64.5534535869956,-54.89567276241819],[-67.0829664543271,-53.971904635372645],[-68.21480367332697,-52.5725694240574],[-68.97634048014879,-50.90158467815955],[-67.63423383235931,-49.99527379838596],[-67.37074267119169,-49.1103052710268],[-65.4176576435566,-47.8745456092152],[-65.42563788592815,-46.873304428698766],[-67.08485506474972,-46.288350138630825],[-66.46077711135149,-45.48149669077311],[-65.2775028347969,-45.30608250202796],[-64.31765288114548,-43.12667753578505],[-64.42404303699732,-41.28259844467922],[-62.18722254037858,-41.24409445851126],[-61.5301775559783,-39.15923504439989],[-58.075040057301514,-38.63349379229863],[-54.978868290781975,-35.00022736748559]
    // ]

    // Sul de mg
    const coordinates = [
        [-45.69782596081495,-21.556028115006185],[-45.61321299523115,-20.95509412456585],[-46.18327226489782,-20.86589883646966],[-46.296668350696564,-21.453050222292262],[-45.69782596081495,-21.556028115006185]
    ]

    const aoi = ee.Geometry.Polygon(coordinates);

    const imageSentinel = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED");
    var colecao = imageSentinel.filterBounds(aoi).filterDate( dataModificada, dataRecebida).sort('CLOUDY_PIXEL_PERCENTAGE')
    var fil = ee.Image(colecao.first()).clip(aoi)

    var data = ee.Date(fil.get('system:time_start')).format('YYYY-MM-dd');
    dataRetorno = null;
    
    // Avalia e imprime os valores
    await data.evaluate(function(dataValue, error) {
        if (error) {
            console.error('Erro ao obter a data:', error);
            return false;
        } else {
            dataRetorno = dataValue;
            console.log('Data de aquisição da imagem:', dataValue);
        }
    });

    var customPalette = ['ff0000', 'ffff00', '008514' ];
  
    const reqFiltro = req.body.filtro;
    if(reqFiltro == 'NDVI')
        var filtro = await calcNDVI(fil, customPalette)
    else if(reqFiltro == 'NDRE')
        var filtro = await calcNDRE(fil, customPalette)
    else
        var filtro = await calcRGB(fil, customPalette)

    res.send({
        "data": dataRetorno,
        "filtro": filtro
    })    
}

const getMap = async (req, res) => {
    const dataRecebida = new Date(req.body.data);
    const dataModificada = new Date(dataRecebida);
    const talhao_id = req.body.talhao_id;

    dataModificada.setDate(dataModificada.getDate() - 5);

    const mapaBd = await procuraGeoJson(talhao_id)
    const jsonMapa = mapaBd['geojson_data']

    const coordinates = jsonMapa.features[0].geometry.coordinates[0];

    const centerArea = coordinates[2]

    const aoi = ee.Geometry.Polygon(coordinates);

    const imageSentinel = ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED");
    var colecao = imageSentinel.filterBounds(aoi).filterDate( dataModificada, dataRecebida).sort('CLOUDY_PIXEL_PERCENTAGE')
    var fil = ee.Image(colecao.first()).clip(aoi)

    var data = ee.Date(fil.get('system:time_start')).format('YYYY-MM-dd');
    dataRetorno = null;
    
    // Avalia e imprime os valores
    await data.evaluate(function(dataValue, error) {
        if (error) {
            console.error('Erro ao obter a data:', error);
            return false;
        } else {
            dataRetorno = dataValue;
            console.log('Data de aquisição da imagem:', dataValue);
        }
    });

    const maskNuvens = fil.select('MSK_CLDPRB').gt(5);

    const totalPixels = fil.select('B4').reduceRegion({
        reducer: ee.Reducer.count(),
        geometry: aoi,
        scale: 10, 
        maxPixels: 1e9
    });
    const cloudPixels = maskNuvens.reduceRegion({
        reducer: ee.Reducer.sum(),
        geometry: aoi,
        scale: 10,
        maxPixels: 1e9
    });
    const totalPixelsValue = await totalPixels.get('B4').getInfo();
    const cloudPixelsValue = await cloudPixels.get('MSK_CLDPRB').getInfo();
    porcentagemNuvensClipada = parseFloat( ( (cloudPixelsValue / totalPixelsValue) * 100 ).toFixed(2) );

  
    var customPalette = ['ff0000', 'ffff00', '008514' ];
  
    const reqFiltro = req.body.filtro;
    if(reqFiltro == 'NDVI')
        var filtro = await calcNDVI(fil, customPalette)
    else if(reqFiltro == 'NDRE')
        var filtro = await calcNDRE(fil, customPalette)
    else
        var filtro = await calcRGB(fil, customPalette)

    res.send({
        "data": dataRetorno,
        "nuvens": porcentagemNuvensClipada,
        "filtro": filtro,
        "centralizacao": centerArea
    })
}


const popularNDVI = async (req, res) => {
    try {
        //const talhao_id = req.body.talhao_id;
        const { talhao_id } = req.params;

        last_date = await ndvi.getMostRecentCaptureDate(talhao_id)
        // if (last_date == null)
        last_date = new Date("2021-06-01");
        console.log(last_date)

        start_date = new Date(last_date)
        //start_date = new Date("2022-08-01")
        start_date.setDate(start_date.getDate() + 1);
        start_date = start_date.toISOString().split('T')[0];

        //const endDate = new Date().toISOString().split('T')[0];
        const endDate = "2022-06-01"

        if ( start_date > endDate )
            res.send();

        // Pega as coordenadas da área
        const mapaBd = await procuraGeoJson(talhao_id)
        const jsonMapa = mapaBd['geojson_data']
        const coordinates = jsonMapa.features[0].geometry.coordinates[0];

        // Cria uma geometria para as cordenadas
        const aoi = ee.Geometry.Polygon(coordinates);

        // Captura todas as imagens entre as datas que tenham até X de cloud
        const imageSentinel = ee.ImageCollection("COPERNICUS/S2_SR");
        var colecao = imageSentinel.filterBounds(aoi)
                                    .filterDate( start_date, endDate)
                                    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 60));

        const size = await eeEvaluate(colecao.size());
        if(size > 0){

            const listaImagens = await colecao.toList(colecao.size()).getInfo();
            console.log(`Número de imagens encontradas: ${listaImagens.length}`);


            let dadosTripla = [] // Cobertura de nuvem, Text ID, e data de aquisicao 

            //listaImagens.map(async (imagemInfo, index) => {
            for (const imagemInfo of listaImagens) {
                console.log('Processando')
                const imagemId = imagemInfo.id;
                const imagem = ee.Image(imagemId);
        
                // Obtém a data de aquisição
                const data = ee.Date(imagem.get('system:time_start')).format('YYYY-MM-dd');
                const dataValue = await data.getInfo();

                // Recorta a imagem para a AOI
                const imagemClipada = imagem.clip(aoi);

                // Seleciona a banda MSK_CLDPRB para máscara de nuvens (valores acima de 50 indicam alta probabilidade de nuvens)
                const maskNuvens = imagemClipada.select('MSK_CLDPRB').gt(5);
                const shadowMask = imagemClipada.select('SCL').eq(3);

                // Conta o número total de pixels na AOI
                const totalPixels = imagemClipada.select('B4').reduceRegion({
                    reducer: ee.Reducer.count(),
                    geometry: aoi,
                    scale: 10, // Resolução de 10 metros para Sentinel-2
                    maxPixels: 1e9
                });

                // Conta o número de pixels nublados na AOI
                const cloudPixels = maskNuvens.reduceRegion({
                    reducer: ee.Reducer.sum(),
                    geometry: aoi,
                    scale: 10,
                    maxPixels: 1e9
                });

                // Conta o número de pixels sombreados
                const shadowPixels = shadowMask.reduceRegion({
                    reducer: ee.Reducer.sum(),
                    geometry: aoi,
                    scale: 10, 
                    maxPixels: 1e9
                })

                const NDVI = imagemClipada.expression(
                    '(nir - red) / (nir + red)',
                    {
                        'nir': imagemClipada.select('B8'), // NIR band
                        'red': imagemClipada.select('B4') // Red  band
                    }
                ).rename('NDVI');
                var meanNDVI = NDVI.reduceRegion({
                    reducer: ee.Reducer.mean(),
                    geometry: aoi,
                    scale: 10, // Escala em metros, ajuste conforme necessário
                    maxPixels: 1e9
                });


                // Obtém os valores como números
                const totalPixelsValue = await totalPixels.get('B4').getInfo();
                const cloudPixelsValue = await cloudPixels.get('MSK_CLDPRB').getInfo();
                const shadowPixelsValue = await shadowPixels.get('SCL').getInfo();
                //console.log('Nuvens: '+ (cloudPixelsValue / totalPixelsValue) * 100);
                //console.log('Sombras: '+ (shadowPixelsValue / totalPixelsValue) * 100);

                // Calcula a porcentagem de cobertura de nuvens na área clipada
                let porcentagemNuvensClipada = 0;
                if (totalPixelsValue > 0) {
                    porcentagemNuvensClipada = parseFloat( ( (cloudPixelsValue / totalPixelsValue) * 100 ).toFixed(2) );
                    porcentagemSombrasClipada = parseFloat( ( (shadowPixelsValue / totalPixelsValue) * 100 ).toFixed(2) );
                    console.log('Data: '+ dataValue + ' . Sombras: '+ porcentagemSombrasClipada + " . Nuvens: " + porcentagemNuvensClipada)

                    if(porcentagemNuvensClipada < 8 && porcentagemSombrasClipada < 20){
                        const ndviMedio = meanNDVI.get('NDVI') ? await meanNDVI.get('NDVI').getInfo() : null;
                        console.log("Ndvi: " + ndviMedio + "\n^^^ Ele de cima entrou ^^^\n")
                        const taxaDeNuvens = porcentagemNuvensClipada + (porcentagemSombrasClipada * 0.65)
                        dadosTripla.push([dataValue, ndviMedio.toFixed(3), parseFloat(taxaDeNuvens), talhao_id]);
                    }
                }


            //});
            };

            //await Promise.all(promises);
            await ndvi.inserirNDVI(dadosTripla)
            console.log(dadosTripla)

        }
        res.send();
    } catch (error) {
        console.log(error);
    }
}


const procuraGeoJson = async (talhao_id) => {

    const busca = await talhoes.findOne( {
        attributes: ['geojson_data'],
        where: { id: talhao_id},
    })

    return busca
}

module.exports = { getMap, getFreeMap, validaMap, popularNDVI }