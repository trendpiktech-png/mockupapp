/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { render, h, Component } from 'preact';
import { GoogleGenAI, Modality } from "@google/genai";

type Product = 't-shirt' | 'pants' | 'phone case' | 'cap' | 'tablet ebook' | 'car sticker' | 'bike sticker' | 'fridge magnet' | 'big bottle' | 'bag mockup' | 'shoes' | 'undergarments' | 'sunglasses';
type ModelType = 'ai' | 'custom';
type AiModelSubject = 'human' | 'car' | 'bike' | 'bus' | 'train' | 'sedan-side' | 'sedan-back' | 'suv-side' | 'suv-back' | 'hatchback-side' | 'hatchback-back';
type StickerType = 'sticker' | 'wrap';
type StickerPlacement = 'body' | 'window';


interface AppState {
  selectedProduct: Product | null;
  designImage: string | null;
  modelType: ModelType;
  aiModelSubject: AiModelSubject | null;
  customModelImage: string | null;
  isLoading: boolean;
  generatedImage: string | null;
  error: string | null;
  stickerType: StickerType;
  stickerPlacement: StickerPlacement;
  credits: number;
  creditKeyInput: string;
  keyStatusMessage: { type: 'success' | 'error', text: string } | null;
  usedKeys: string[];
  deviceId: string | null;
}

// FIX: Refactored class methods to arrow functions to ensure `this` is correctly bound, resolving issues with `this.setState`.
class App extends Component<{}, AppState> {
  ai: GoogleGenAI | null = null;

  state: AppState = {
    selectedProduct: null,
    designImage: null,
    modelType: 'ai',
    aiModelSubject: null,
    customModelImage: null,
    isLoading: false,
    generatedImage: null,
    error: null,
    stickerType: 'sticker',
    stickerPlacement: 'body',
    credits: 3,
    creditKeyInput: '',
    keyStatusMessage: null,
    usedKeys: [],
    deviceId: null,
  };

  componentDidMount() {
    try {
      this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
    } catch (e) {
      console.error(e);
      this.setState({ error: 'Failed to initialize AI. Check API Key.' });
    }
    
    // Load from localStorage
    const savedCredits = localStorage.getItem('numcount_credits');
    const savedUsedKeys = localStorage.getItem('numcount_usedKeys');
    let deviceId = localStorage.getItem('numcount_deviceId');

    if (!deviceId) {
      // Generate a simple unique ID
      deviceId = Date.now().toString(36) + Math.random().toString(36).substring(2);
      localStorage.setItem('numcount_deviceId', deviceId);
    }
    
    this.setState({
      credits: savedCredits ? parseInt(savedCredits, 10) : 3,
      usedKeys: savedUsedKeys ? JSON.parse(savedUsedKeys) : [],
      deviceId: deviceId,
    });
  }
  
  saveStateToLocalStorage = (newState: Partial<AppState>) => {
    if (newState.credits !== undefined) {
      localStorage.setItem('numcount_credits', newState.credits.toString());
    }
    if (newState.usedKeys) {
      localStorage.setItem('numcount_usedKeys', JSON.stringify(newState.usedKeys));
    }
  }

  handleProductSelect = (p: Product) => {
    const apparelProducts: Product[] = ['t-shirt', 'pants', 'cap', 'bag mockup', 'shoes', 'undergarments', 'sunglasses'];

    let newAiSubject: AiModelSubject | null = null;
    if (apparelProducts.includes(p)) {
      newAiSubject = 'human';
    } else if (p === 'car sticker') {
      newAiSubject = 'sedan-side'; // Default to sedan-side for car stickers
    } else if (p === 'bike sticker') {
      newAiSubject = 'bike';
    }

    this.setState({ selectedProduct: p, aiModelSubject: newAiSubject, modelType: 'ai', stickerType: 'sticker', stickerPlacement: 'body' });
  }

  handleFileChange = (e: Event, type: 'design' | 'customModel') => {
    const target = e.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (type === 'design') {
          this.setState({ designImage: reader.result as string });
        } else {
          this.setState({ customModelImage: reader.result as string });
        }
      };
      reader.readAsDataURL(file);
    }
  }
  
  // A simple, predictable function to simulate admin-side key generation logic
  generateValidationHash = (deviceId: string): string => {
    return deviceId.split('').reverse().join('').substring(0, 8).toUpperCase();
  }

  handleApplyUnlockKey = () => {
    const { creditKeyInput, usedKeys, deviceId } = this.state;
    if (!deviceId) {
      this.setState({ keyStatusMessage: { type: 'error', text: 'Device ID not found. Please refresh.' } });
      return;
    }
    
    const key = creditKeyInput.trim().toUpperCase();

    if (usedKeys.includes(key)) {
      this.setState({ keyStatusMessage: { type: 'error', text: 'This key has already been used.' } });
      return;
    }

    const parts = key.split('-');
    if (parts.length !== 3 || parts[0] !== 'UNLOCK') {
      this.setState({ keyStatusMessage: { type: 'error', text: 'Invalid key format. Expected: UNLOCK-AMOUNT-HASH' } });
      return;
    }

    const creditsToAdd = parseInt(parts[1], 10);
    const keyHash = parts[2];
    
    if (isNaN(creditsToAdd) || creditsToAdd <= 0) {
      this.setState({ keyStatusMessage: { type: 'error', text: 'Invalid credit amount in key.' } });
      return;
    }

    const expectedHash = this.generateValidationHash(deviceId);

    if (keyHash === expectedHash) {
      const newCredits = this.state.credits + creditsToAdd;
      const newUsedKeys = [...usedKeys, key];
      
      this.setState({
        credits: newCredits,
        usedKeys: newUsedKeys,
        creditKeyInput: '',
        keyStatusMessage: { type: 'success', text: `${creditsToAdd} credits added successfully!` },
      });
      
      this.saveStateToLocalStorage({ credits: newCredits, usedKeys: newUsedKeys });
    } else {
      this.setState({ keyStatusMessage: { type: 'error', text: 'Invalid key for this device.' } });
    }
  };

  generateMockup = async () => {
    if (!this.ai || !this.state.selectedProduct || !this.state.designImage) return;

    this.setState({ isLoading: true, error: null, generatedImage: null });

    try {
      const { selectedProduct, designImage, modelType, customModelImage, aiModelSubject, stickerType, stickerPlacement } = this.state;

      const parts: any[] = [];
      let promptText = '';

      const designImagePart = {
        inlineData: {
          data: designImage.split(',')[1],
          mimeType: designImage.split(';')[0].split(':')[1],
        },
      };

      const tryOnProducts: Product[] = ['shoes', 'undergarments', 'sunglasses'];
      const isTryOnProduct = selectedProduct && tryOnProducts.includes(selectedProduct);

      if (modelType === 'custom' && customModelImage) {
        const customModelPart = {
          inlineData: {
            data: customModelImage.split(',')[1],
            mimeType: customModelImage.split(';')[0].split(':')[1],
          },
        };

        if (isTryOnProduct) {
          promptText = `First, analyze the human model in the provided base image to understand their unique features, ethnicity, and appearance. Then, generate a completely new 4-panel photorealistic mockup collage. Each panel must feature the exact same model from the base image, but in a different realistic pose and camera angle. For each panel, the model should be wearing the provided ${selectedProduct} from the second image. The ${selectedProduct} must be fitted realistically to the model, conforming to their pose, lighting, and perspective. Use minimalist, clean studio backdrops for a professional look.`;
          parts.push(customModelPart, designImagePart, { text: promptText });
        } else {
            const apparelProducts: Product[] = ['t-shirt', 'pants', 'cap', 'bag mockup'];

            if (selectedProduct && apparelProducts.includes(selectedProduct)) {
                let productDescription = `a plain white ${selectedProduct}`;
                let actionDescription = "wearing";
                if (selectedProduct === 'bag mockup') {
                    productDescription = "a plain white tote bag";
                    actionDescription = "naturally holding or wearing";
                }
                promptText = `First, analyze the human model in the provided base image to understand their unique features, ethnicity, and appearance. Then, generate a completely new 4-panel photorealistic mockup collage. Each panel must feature the exact same model from the base image, but in a different realistic pose and camera angle (e.g., front view, side view, close-up). For each panel, the model should be ${actionDescription} ${productDescription} with the provided design applied to it. The design must conform realistically to the item's texture, folds, and lighting. Use minimalist, clean studio backdrops for a professional look.`;
            } else {
                // This handles stickers on custom vehicles.
                promptText = `Using the first image as the base, place the second image (the design) onto the ${selectedProduct}. The design should follow the contours, shadows, and texture of the item for a realistic effect. Do not alter the base image otherwise.`;
            }

            parts.push(customModelPart, designImagePart, { text: promptText });
        }
      } else {
        // AI Model Logic
        if (isTryOnProduct) {
             promptText = `Generate a 4-panel photorealistic mockup collage. Each panel should feature a diverse model wearing the provided ${selectedProduct} from the image. Showcase different poses, angles (like a front view, side view, and a close-up on the product), and minimalist studio backdrops to create a professional and varied presentation. The ${selectedProduct} must be integrated realistically, matching the model's pose, lighting, and perspective.`;
        } else {
            switch (selectedProduct) {
              case 't-shirt':
              case 'pants':
              case 'cap':
                promptText = `Generate a 4-panel photorealistic mockup collage. Each panel should feature a diverse model wearing a plain white ${selectedProduct} with the provided design applied. Showcase different poses, angles (like a front view, side view, and a close-up on the design), and minimalist studio backdrops to create a professional and varied presentation.`;
                break;
              case 'bag mockup':
                promptText = `Generate a 4-panel photorealistic mockup collage. Each panel should feature a diverse model holding or wearing a plain white tote bag with the provided design applied. Showcase the bag from different angles and in different lifestyle settings (e.g., at a cafe, over the shoulder, close-up on the design) to create a professional and varied presentation.`;
                break;
              case 'phone case':
                promptText = `Generate a clean, professional 8-panel grid showcasing a phone case with the provided design. Each panel should feature a different modern smartphone model or a different angle (front, back, angled view). The background for all panels should be a neutral, minimalist surface. Do not include any people.`;
                break;
              case 'tablet ebook':
                promptText = `Generate a clean, professional 6-panel grid showcasing the provided design on the screen of a modern tablet or e-book reader. Each panel should show the device from a different angle or in a different minimalist setting (e.g., on a coffee table, held in hands). The background should be clean and unobtrusive.`;
                break;
              case 'car sticker':
              case 'bike sticker':
                {
                    let basePrompt = '';
                    if (aiModelSubject === 'bus') {
                        if (stickerType === 'wrap') {
                            basePrompt = "Generate a 4-panel photorealistic collage showcasing a standard city bus with a full vehicle wrap using the provided design. Each panel should display the bus from a different angle (e.g., side profile, front three-quarter, rear three-quarter) in a clean, urban setting. The wrap must conform realistically to the bus's shape, including indentations for windows and wheel wells. Ensure lighting, shadows, and reflections on the wrap match the bus's environment perfectly for a seamless look.";
                        } else { // sticker
                            basePrompt = "Generate a 4-panel photorealistic collage showcasing a standard city bus with a high-quality vinyl sticker of the provided design. Each panel should display the bus from a different angle (e.g., side profile, close-up on sticker) in a clean, urban setting. The sticker must realistically follow the bus's contours. Ensure the sticker's lighting, shadows, and reflections perfectly match the bus's paint finish.";
                        }
                    } else if (aiModelSubject === 'train') {
                        if (stickerType === 'wrap') {
                            basePrompt = "Generate a 4-panel photorealistic collage showcasing a modern passenger train car with a full vehicle wrap from the provided design. Each panel should display the train from a different perspective (e.g., full side view at a station, angled shot in motion) to highlight the wrap. The wrap must conform realistically to the train's shape, including around windows and doors. Ensure lighting and reflections are consistent with a modern station platform environment.";
                        } else { // sticker
                            basePrompt = "Generate a 4-panel photorealistic collage showcasing a modern passenger train car with a high-quality vinyl sticker of the provided design. Each panel should feature the train from a different angle, including a close-up on the sticker application. The sticker must realistically follow the train's contours and have lighting/reflections appropriate for a clean, modern station platform.";
                        }
                    } else if (aiModelSubject === 'bike') {
                         if (stickerType === 'wrap') {
                            basePrompt = `Generate a 4-panel photorealistic collage showcasing a modern motorcycle with a full vehicle wrap using the provided design. Each panel should feature the bike from a different dynamic angle or in a different setting (city street, scenic road) to highlight the wrap's appearance. The wrap must realistically follow the bike's contours and curves, with lighting and reflections matching the environment.`;
                        } else { // 'sticker'
                            basePrompt = `Generate a 4-panel photorealistic collage showcasing a modern motorcycle with a high-quality vinyl sticker of the provided design. Each panel should feature the bike from a different dynamic angle, including a close-up on the sticker. The sticker must realistically wrap around the vehicle's contours, and its lighting and reflections must match the bike's glossy paint finish.`;
                        }
                    } else { // Default to CAR logic
                        let vehicleType = 'sedan car';
                        let vehicleAngle = 'from the side';

                        if (aiModelSubject?.includes('sedan')) vehicleType = 'sedan car';
                        else if (aiModelSubject?.includes('suv')) vehicleType = 'SUV';
                        else if (aiModelSubject?.includes('hatchback')) vehicleType = 'hatchback car';
                        
                        if (aiModelSubject?.includes('back')) vehicleAngle = 'from the rear';
                        
                        if (stickerType === 'wrap') {
                            basePrompt = `Generate a 4-panel photorealistic collage showcasing a clean, modern Indian ${vehicleType} with a full vehicle wrap using the provided design. Each panel should feature the car from a different angle (e.g., ${vehicleAngle}, three-quarter view, close-up) or in a different realistic setting (city street, showroom). The wrap must realistically follow the vehicle's contours, with lighting and reflections matching for a seamless look.`;
                        } else { // 'sticker'
                            if (stickerPlacement === 'window') {
                                basePrompt = `Generate a 4-panel photorealistic collage showcasing a **die-cut vinyl sticker** of the provided design on the rear window of a modern Indian ${vehicleType}. The sticker must be **cut out precisely along the design's edges** (no rectangular background). Each panel should show the car from a different angle (${vehicleAngle}, close-up on sticker) or in a different well-lit, realistic setting. The sticker should appear semi-translucent, adhering to the glass with realistic reflections.`;
                            } else { // 'body'
                                basePrompt = `Generate a 4-panel photorealistic collage showcasing a high-quality vinyl sticker of the provided design on a clean, modern Indian ${vehicleType}. Each panel should feature the car from a different angle (e.g., ${vehicleAngle}, three-quarter view, close-up on sticker) to highlight the application. The sticker must realistically wrap around contours, with lighting and reflections matching the vehicle's glossy paint finish.`;
                            }
                        }
                    }
                    promptText = basePrompt;
                }
                break;
              case 'fridge magnet':
                promptText = `Generate a 4-panel photorealistic mockup collage. Each panel should showcase the provided design as a magnet on a refrigerator. Include a variety of shots: a straight-on view on a stainless steel fridge, an angled view, a close-up on the magnet's texture, and the fridge in a modern kitchen setting to provide context.`;
                break;
              case 'big bottle':
                promptText = `Generate a 4-panel photorealistic mockup collage. Each panel should showcase the provided design as a label on a large, reusable water bottle (hydro flask style). Include a variety of shots: a clean studio shot of the bottle, the bottle in a lifestyle setting (like a gym or on a desk), a close-up on the design label, and an angled view.`;
                break;
              default:
                promptText = `Generate a 4-panel photorealistic mockup collage of the provided design on a white ${selectedProduct} in various minimalist studio settings and angles.`;
                break;
            }
        }
        parts.push(designImagePart, { text: promptText });
      }

      if (parts.length === 0 || promptText === '') {
        this.setState({ error: 'Could not generate a prompt for the selected options.', isLoading: false });
        return;
      }

      const response = await this.ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts },
        config: {
          // FIX: According to the guidelines, responseModalities for image generation should only contain Modality.IMAGE.
          responseModalities: [Modality.IMAGE],
        },
      });

      let foundImage = false;
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          const base64Image = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
          const newCredits = this.state.credits - 1;
          this.setState({ generatedImage: base64Image, isLoading: false, credits: newCredits });
          this.saveStateToLocalStorage({ credits: newCredits });
          foundImage = true;
          break;
        }
      }
      if (!foundImage) {
        throw new Error("The AI did not return an image. Please try a different prompt or design.");
      }

    } catch (e) {
      console.error(e);
      this.setState({
        error: `An error occurred during generation: ${(e as Error).message}`,
        isLoading: false,
      });
    }
  }
  
  handleDownload = () => {
    const { generatedImage, selectedProduct } = this.state;
    if (!generatedImage) return;

    // Create a temporary link element
    const link = document.createElement('a');
    link.href = generatedImage;
    
    // Suggest a filename for the download
    const fileName = `${selectedProduct?.replace(' ', '-') || 'generated'}-mockup.png`;
    link.download = fileName;

    // Append to the body, click, and then remove
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  render() {
    const { selectedProduct, designImage, modelType, customModelImage, isLoading, generatedImage, error, aiModelSubject, stickerType, stickerPlacement, credits, creditKeyInput, keyStatusMessage, deviceId } = this.state;

    const productList: Product[] = ['t-shirt', 'pants', 'cap', 'bag mockup', 'phone case', 'tablet ebook', 'car sticker', 'bike sticker', 'fridge magnet', 'big bottle', 'shoes', 'undergarments', 'sunglasses'];
    const productsWithModelSelection: Product[] = ['t-shirt', 'pants', 'cap', 'bag mockup', 'shoes', 'undergarments', 'sunglasses'];
    const stickerProducts: Product[] = ['car sticker', 'bike sticker'];
    
    const showModelSelection = selectedProduct && (productsWithModelSelection.includes(selectedProduct) || stickerProducts.includes(selectedProduct));
    
    const showAiSubjectSelection = modelType === 'ai' && showModelSelection;
    
    const isGenerateDisabled = isLoading || !selectedProduct || !designImage || (showModelSelection && modelType === 'custom' && !customModelImage) || credits <= 0;

    const carSubTypes: Record<string, string> = {
      'sedan-side': 'Sedan (Side)',
      'sedan-back': 'Sedan (Back)',
      'suv-side': 'SUV (Side)',
      'suv-back': 'SUV (Back)',
      'hatchback-side': 'Hatchback (Side)',
      'hatchback-back': 'Hatchback (Back)',
    };
    const carSubjectKeys: AiModelSubject[] = Object.keys(carSubTypes) as AiModelSubject[];
    const isCarSubjectSelected = aiModelSubject !== null && carSubjectKeys.includes(aiModelSubject);
    
    const vehicleSubjects: AiModelSubject[] = [...carSubjectKeys, 'bike', 'bus', 'train'];
    const isVehicleSubjectSelected = aiModelSubject !== null && vehicleSubjects.includes(aiModelSubject);
    const showStickerTypeSelection = showAiSubjectSelection && isVehicleSubjectSelected;
    const showPlacementSelection = selectedProduct === 'car sticker' && stickerType === 'sticker';
    
    const tryOnProducts: Product[] = ['shoes', 'undergarments', 'sunglasses'];
    const isTryOnProduct = selectedProduct && tryOnProducts.includes(selectedProduct);
    const uploadTitle = isTryOnProduct ? '2. Upload Product Image' : '2. Upload Design';
    const uploadLabel = isTryOnProduct ? 'Select Product File' : 'Select Design File';

    return (
      h('div', { id: 'app-container' },
        h('header', {},
            h('div', { className: 'title-container' },
                h('div', { className: 'logo' }),
                h('h1', {}, 'Numcount Mockups')
            ),
            h('div', { className: 'credits-counter' }, `Credits: ${credits}`)
        ),
        h('main', {},
          h('aside', { className: 'controls-panel' },
            h('div', { className: 'control-group' },
              h('h2', {}, '1. Choose Product'),
              h('div', { className: 'button-group' },
                productList.map(p =>
                  h('button', {
                    className: `control-button ${selectedProduct === p ? 'active' : ''}`,
                    onClick: () => this.handleProductSelect(p)
                  }, p.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))
                )
              )
            ),
            h('div', { className: 'control-group' },
              h('h2', {}, uploadTitle),
              h('label', { for: 'design-upload', className: 'file-label' }, uploadLabel),
              h('input', { type: 'file', id: 'design-upload', accept: 'image/*', onChange: (e) => this.handleFileChange(e, 'design') }),
              designImage && h('img', { src: designImage, className: 'image-preview', alt: 'Design Preview' })
            ),
            showModelSelection && h('div', { className: 'control-group' },
              h('h2', {}, '3. Choose Model/Surface'),
              h('div', { className: 'radio-group' },
                h('label', { className: 'radio-label' },
                  h('input', { type: 'radio', name: 'modelType', value: 'ai', checked: modelType === 'ai', onChange: () => this.setState({ modelType: 'ai' }) }),
                  'AI Generated'
                ),
                h('label', { className: 'radio-label' },
                  h('input', { type: 'radio', name: 'modelType', value: 'custom', checked: modelType === 'custom', onChange: () => this.setState({ modelType: 'custom' }) }),
                  'Upload Your Own'
                )
              ),
              showAiSubjectSelection && h('div', { className: 'sub-group' },
                (selectedProduct && productsWithModelSelection.includes(selectedProduct)) && h('div', {},
                  h('h3', {}, 'AI Subject'),
                  h('div', { className: 'button-group' },
                    h('button', {
                      className: `control-button ${aiModelSubject === 'human' ? 'active' : ''}`,
                      onClick: () => this.setState({ aiModelSubject: 'human' })
                    }, 'Human')
                  )
                ),
                (selectedProduct && stickerProducts.includes(selectedProduct)) && h('div', {},
                  h('h3', {}, 'AI Subject'),
                  h('div', { className: 'button-group' },
                      h('button', {
                        className: `control-button ${isCarSubjectSelected ? 'active' : ''}`,
                        onClick: () => this.setState({ aiModelSubject: 'sedan-side' })
                      }, 'Car'),
                      h('button', {
                        className: `control-button ${aiModelSubject === 'bike' ? 'active' : ''}`,
                        onClick: () => this.setState({ aiModelSubject: 'bike' })
                      }, 'Bike'),
                      h('button', {
                        className: `control-button ${aiModelSubject === 'bus' ? 'active' : ''}`,
                        onClick: () => this.setState({ aiModelSubject: 'bus' })
                      }, 'Bus'),
                      h('button', {
                        className: `control-button ${aiModelSubject === 'train' ? 'active' : ''}`,
                        onClick: () => this.setState({ aiModelSubject: 'train' })
                      }, 'Train'),
                  ),
                  isCarSubjectSelected && h('div', { className: 'sub-group' },
                    h('h3', {}, 'Car Type'),
                    h('div', { className: 'button-group' },
                       Object.entries(carSubTypes).map(([key, value]) =>
                        h('button', {
                          className: `control-button ${aiModelSubject === key ? 'active' : ''}`,
                          onClick: () => this.setState({ aiModelSubject: key as AiModelSubject })
                        }, value)
                      )
                    )
                  ),
                  showStickerTypeSelection && h('div', { className: 'sub-group' },
                    h('h3', {}, 'Application Type'),
                    h('div', { className: 'button-group' },
                        h('button', {
                            className: `control-button ${stickerType === 'sticker' ? 'active' : ''}`,
                            onClick: () => this.setState({ stickerType: 'sticker' })
                        }, 'Sticker'),
                        h('button', {
                            className: `control-button ${stickerType === 'wrap' ? 'active' : ''}`,
                            onClick: () => this.setState({ stickerType: 'wrap' })
                        }, 'Full Wrap')
                    )
                  ),
                  showPlacementSelection && h('div', { className: 'sub-group' },
                    h('h3', {}, 'Sticker Placement'),
                    h('div', { className: 'button-group' },
                        h('button', {
                            className: `control-button ${stickerPlacement === 'body' ? 'active' : ''}`,
                            onClick: () => this.setState({ stickerPlacement: 'body' })
                        }, 'Body Panel'),
                        h('button', {
                            className: `control-button ${stickerPlacement === 'window' ? 'active' : ''}`,
                            onClick: () => this.setState({ stickerPlacement: 'window' })
                        }, 'Rear Window')
                    )
                  )
                )
              ),
              modelType === 'custom' && h('div', { className: 'sub-group' },
                h('label', { for: 'model-upload', className: 'file-label' }, 'Select Model Image'),
                h('input', { type: 'file', id: 'model-upload', accept: 'image/*', onChange: (e) => this.handleFileChange(e, 'customModel') }),
                customModelImage && h('img', { src: customModelImage, className: 'image-preview', alt: 'Model Preview' }),
                (modelType === 'custom' && selectedProduct && productsWithModelSelection.includes(selectedProduct)) && h('p', {className: 'helper-text'}, 'Note: The AI will use your model\'s likeness to generate a new 4-panel collage with different poses.')
              )
            ),
            h('button', { className: 'generate-button', onClick: this.generateMockup, disabled: isGenerateDisabled },
              isLoading ? 'Generating...' : 'Generate Mockup'
            ),
            credits <= 0 && h('div', { className: 'pricing-message' },
              h('h3', {}, "You're out of credits!"),
              h('p', {}, 'Provide your Device ID to the admin to get an unlock key.'),
              h('div', { className: 'device-id-container' },
                  h('span', { className: 'device-id-label' }, 'Your Device ID'),
                  h('code', { className: 'device-id-code' }, deviceId)
              ),
              h('div', { className: 'credit-key-container' },
                 h('input', {
                   type: 'text',
                   className: 'credit-key-input',
                   placeholder: 'Enter Unlock Key',
                   value: creditKeyInput,
                   onInput: (e) => this.setState({ creditKeyInput: (e.target as HTMLInputElement).value, keyStatusMessage: null })
                 }),
                 h('button', { className: 'apply-key-button', onClick: this.handleApplyUnlockKey }, 'Apply')
              ),
              keyStatusMessage && h('p', {
                className: `key-status-message ${keyStatusMessage.type}`
              }, keyStatusMessage.text)
            ),
            error && credits > 0 && h('div', { className: 'error-message' }, error)
          ),
          h('section', { className: 'display-panel' },
            isLoading && h('div', { className: 'loader-overlay' },
              h('div', { className: 'spinner' }),
              h('p', {}, 'Generating your mockup...')
            ),
            !generatedImage && !isLoading && h('div', { className: 'placeholder' },
              h('h3', {}, 'Your generated mockup will appear here')
            ),
            generatedImage && h('div', { className: 'result-container' },
              h('img', { src: generatedImage, className: 'result-image', alt: 'Generated Mockup' }),
              h('button', { className: 'download-button', onClick: this.handleDownload }, 'Download Mockup')
            )
          )
        )
      )
    );
  }
}

render(h(App, {}), document.getElementById('root')!);
