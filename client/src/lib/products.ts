// Static product catalog — no backend needed
export interface Product {
  id: string;
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  price: number;
  compareAtPrice?: number;
  category: string;
  tags: string[];
  imageUrl: string;
  inStock: boolean;
  stockQuantity?: number;
  sku: string;
  featured: boolean;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export const PRODUCTS: Product[] = [
  { id:"1", name:"BPC-157", slug:"bpc-157", subtitle:"Body Protection Compound", description:"BPC-157 is a synthetic peptide consisting of 15 amino acids, discovered in and isolated from human gastric juice. For laboratory research use only.", price:4999, compareAtPrice:6999, category:"Peptides", tags:["research","peptide"], imageUrl:"https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=400&q=80", inStock:true, stockQuantity:100, sku:"BPC-157-5MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"2", name:"TB-500", slug:"tb-500", subtitle:"Thymosin Beta-4 Fragment", description:"TB-500 is a synthetic version of the naturally occurring peptide present in virtually all human and animal cells. Research compound for laboratory use only.", price:5999, compareAtPrice:7999, category:"Peptides", tags:["research","peptide"], imageUrl:"https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=400&q=80", inStock:true, stockQuantity:80, sku:"TB-500-5MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"3", name:"GHK-Cu", slug:"ghk-cu", subtitle:"Copper Peptide Complex", description:"GHK-Cu is a naturally occurring copper complex of the tripeptide glycyl-L-histidyl-L-lysine. Research compound for laboratory use only.", price:5499, compareAtPrice:7499, category:"Peptides", tags:["research","peptide","copper"], imageUrl:"https://images.unsplash.com/photo-1576086213369-97a306d36557?w=400&q=80", inStock:true, stockQuantity:60, sku:"GHK-CU-100MG", featured:true, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"4", name:"Ipamorelin", slug:"ipamorelin", subtitle:"Growth Hormone Secretagogue", description:"Ipamorelin is a peptide selective agonist of the ghrelin/growth hormone secretagogue receptor. Research compound for laboratory use only.", price:4499, compareAtPrice:5999, category:"Peptides", tags:["research","peptide","gh"], imageUrl:"https://images.unsplash.com/photo-1582719508461-905c673771fd?w=400&q=80", inStock:true, stockQuantity:90, sku:"IPA-5MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"5", name:"CJC-1295", slug:"cjc-1295", subtitle:"GHRH Analog", description:"CJC-1295 is a synthetic analogue of growth hormone-releasing hormone. Research compound for laboratory use only.", price:4999, compareAtPrice:6499, category:"Peptides", tags:["research","peptide","gh"], imageUrl:"https://images.unsplash.com/photo-1585435557343-3b092031a831?w=400&q=80", inStock:true, stockQuantity:70, sku:"CJC-2MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"6", name:"Selank", slug:"selank", subtitle:"Anxiolytic Peptide", description:"Selank is a synthetic analogue of the immunomodulatory peptide tuftsin. Research compound for laboratory use only.", price:3999, compareAtPrice:5499, category:"Peptides", tags:["research","peptide","nootropic"], imageUrl:"https://images.unsplash.com/photo-1563213126-a4273aed2016?w=400&q=80", inStock:true, stockQuantity:50, sku:"SEL-5MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"7", name:"Semax", slug:"semax", subtitle:"Neuropeptide Analog", description:"Semax is based on the adrenocorticotropic hormone (ACTH) fragment. Research compound for laboratory use only.", price:3999, compareAtPrice:5499, category:"Peptides", tags:["research","peptide","nootropic"], imageUrl:"https://images.unsplash.com/photo-1614308458638-deab8c29a98d?w=400&q=80", inStock:true, stockQuantity:45, sku:"SEMAX-30MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"8", name:"Epithalon", slug:"epithalon", subtitle:"Tetrapeptide", description:"Epithalon (Epitalon) is a tetrapeptide consisting of four amino acids. Research compound for laboratory use only.", price:4499, compareAtPrice:5999, category:"Peptides", tags:["research","peptide"], imageUrl:"https://images.unsplash.com/photo-1602052793312-b99c2a9ee797?w=400&q=80", inStock:true, stockQuantity:55, sku:"EPITH-10MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"9", name:"PT-141", slug:"pt-141", subtitle:"Bremelanotide", description:"PT-141 (Bremelanotide) is a melanocortin receptor agonist. Research compound for laboratory use only.", price:4999, compareAtPrice:6499, category:"Peptides", tags:["research","peptide"], imageUrl:"https://images.unsplash.com/photo-1559757175-5700dde675bc?w=400&q=80", inStock:true, stockQuantity:40, sku:"PT141-10MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
  { id:"10", name:"AOD-9604", slug:"aod-9604", subtitle:"Anti-Obesity Drug Fragment", description:"AOD-9604 is a modified fragment of human growth hormone. Research compound for laboratory use only.", price:4999, compareAtPrice:6499, category:"Peptides", tags:["research","peptide","gh"], imageUrl:"https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=400&q=80", inStock:true, stockQuantity:35, sku:"AOD-5MG", featured:false, published:true, createdAt:"2024-01-01T00:00:00Z", updatedAt:"2024-01-01T00:00:00Z" },
];

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((p) => p.slug === slug);
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter((p) => p.featured && p.published);
}

export function getAllProducts(): Product[] {
  return PRODUCTS.filter((p) => p.published);
}
